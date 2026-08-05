// Extract stage: reads a project's current source_items (text and image only —
// voice sources are explicitly out of scope for this phase), calls Claude for
// classified facts/preferences/constraints plus contradiction/gap flags, and
// persists both tied to the snapshot of source_items that produced them.
// This never resolves or softens a flag — only surfaces it for the planner.
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CATEGORIES = [
  'atmosphere',
  'formality',
  'colour_material',
  'floral_approach',
  'guest_experience',
  'exclusions',
]

const EXTRACTED_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['category', 'content', 'source_item_ids'],
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    content: { type: 'string' },
    source_item_ids: { type: 'array', items: { type: 'string' } },
  },
}

const FLAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'description', 'evidence', 'source_item_ids', 'suggested_resolutions'],
  properties: {
    type: { type: 'string', enum: ['contradiction', 'gap'] },
    description: { type: 'string' },
    evidence: { type: 'string' },
    source_item_ids: { type: 'array', items: { type: 'string' } },
    suggested_resolutions: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Only when the flag genuinely reduces to 2-3 discrete, obvious options (e.g. "which linen colour"), a short label for each option. Empty array otherwise — do not force options onto an open-ended question.',
    },
  },
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['extracted_items', 'flags'],
  properties: {
    extracted_items: { type: 'array', items: EXTRACTED_ITEM_SCHEMA },
    flags: { type: 'array', items: FLAG_SCHEMA },
  },
}

const SYSTEM_PROMPT = `You are the Extract stage for Wedding Brief Studio, a tool used by professional wedding planners.

Your only job is to read the collected source material for a wedding project and produce two things: classified facts/preferences/constraints, and flags for contradictions and gaps. You do not resolve, soften, or choose between conflicting preferences. If the couple said two things that do not fit together, or one person's input conflicts with another's (partner vs partner, couple vs family, couple vs venue constraint), flag it and describe both sides plainly — the planner decides what to do next, not you. Never quietly pick a winner between conflicting inputs, and never blend a contradiction into a single averaged statement.

Do not invent facts that are not in the source material. Where necessary information is simply missing (no guest count discussed, no indication of formality, a decision mentioned as unresolved), flag it as a gap rather than guessing or filling it in.

Classify every fact, preference, or constraint you extract into exactly one of these categories:
- atmosphere: the overall mood, feeling, energy of the event
- formality: how formal, casual, dressed-up, or relaxed the wedding should feel
- colour_material: colour palette, materials, fabrics, finishes
- floral_approach: floral style, forms, quantity, placement
- guest_experience: format of the day, dining style, pacing, what guests will do and feel
- exclusions: explicit dislikes, rule-outs, "not this", what to avoid

Each extracted item's "source_item_ids" must list the id(s) of the source item(s) it was drawn from — every source item you are given is labeled with its id. Do not cite an id that was not given to you.

For every flag (contradiction or gap), write a plain description of what the tension or gap actually is, and separately an "evidence" string that quotes or closely paraphrases the specific material that shows it. Cite the relevant source_item_ids as evidence. A gap may have no source items to cite (that is what makes it a gap) — in that case return an empty array, but still describe in "evidence" what was searched for and not found.

For "suggested_resolutions": most flags do not get any — leave the array empty. Only populate it when the flag genuinely reduces to a small set of concrete, mutually exclusive options that were themselves present in the source material (e.g. two named colours a couple is choosing between). Never invent an option that wasn't actually raised by someone. Open-ended questions, vague tensions, and gaps almost never qualify — when in doubt, leave it empty rather than force a false choice.

Do not group multiple distinct contradictions into a single flag. Do not skip a genuine contradiction because it seems minor. Do not skip a genuine gap because it seems obvious.`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { project_id } = await req.json()
    if (!project_id) {
      return json({ error: 'project_id is required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // Scoped to the caller's own JWT so RLS enforces "this project's own
    // source_items only" without any extra checks here.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: project, error: projectError } = await userClient
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      return json({ error: 'Project not found' }, 404)
    }

    const { data: allSourceItems, error: sourceError } = await userClient
      .from('source_items')
      .select('*')
      .eq('project_id', project_id)
      .order('added_at', { ascending: true })

    if (sourceError) {
      return json({ error: sourceError.message }, 500)
    }

    // Voice sources are out of scope for this phase; text and image only.
    const sourceItems = (allSourceItems ?? []).filter(
      (item: { type: string }) => item.type !== 'voice_note',
    )

    if (sourceItems.length === 0) {
      return json({ error: 'No text or image source items to extract from yet' }, 400)
    }

    const knownIds = new Set(sourceItems.map((item: { id: string }) => item.id))

    const imageItems = sourceItems.filter(
      (item: { type: string; file_path: string | null }) => item.type === 'image' && item.file_path,
    )
    const signedImages = await Promise.all(
      imageItems.map(async (item: { id: string; file_path: string; added_at: string; attribution: string | null }) => {
        const { data } = await userClient.storage.from('source-files').createSignedUrl(item.file_path, 300)
        return data?.signedUrl
          ? { id: item.id, url: data.signedUrl, addedAt: item.added_at, attribution: item.attribution }
          : null
      }),
    )

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: apiKey, error: secretError } = await serviceClient.rpc('get_secret', {
      secret_name: 'anthropic_api_key',
    })
    if (secretError || !apiKey) {
      return json({ error: 'Anthropic API key not configured' }, 500)
    }

    const textLines: string[] = []
    textLines.push(`Project: ${project.couple_names ?? 'Untitled'}`)
    if (project.venue) textLines.push(`Venue: ${project.venue}`)
    if (project.wedding_date) textLines.push(`Date: ${project.wedding_date}`)
    if (project.guest_count != null) textLines.push(`Guest count: ${project.guest_count}`)
    if (project.budget != null) textLines.push(`Budget: $${project.budget} AUD`)
    textLines.push('')
    textLines.push('Source material. Each item is labeled with its id — use these exact ids in source_item_ids.')

    for (const item of sourceItems) {
      if (item.type === 'image') continue
      const label =
        item.type === 'structured_field' ? 'Like/dislike' : 'Note'
      const attribution = item.attribution ? `, attributed to ${item.attribution}` : ''
      if (item.raw_content) {
        textLines.push(`- [id: ${item.id}, ${label}${attribution}, ${item.added_at}] ${item.raw_content}`)
      }
    }

    if (imageItems.length > 0) {
      textLines.push('')
      textLines.push('Image source items follow as image content blocks, each preceded by its id.')
    }

    // deno-lint-ignore no-explicit-any
    const userContent: any[] = [{ type: 'text', text: textLines.join('\n') }]
    for (const img of signedImages) {
      if (img) {
        const attribution = img.attribution ? `, attributed to ${img.attribution}` : ''
        userContent.push({
          type: 'text',
          text: `Image source item [id: ${img.id}${attribution}, added ${img.addedAt}]:`,
        })
        userContent.push({ type: 'image', source: { type: 'url', url: img.url } })
      }
    }

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: EXTRACTION_SCHEMA,
        },
        // deno-lint-ignore no-explicit-any
      } as any,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    // deno-lint-ignore no-explicit-any
    const textBlock = message.content.find((b: any) => b.type === 'text') as any
    if (!textBlock) {
      return json({ error: 'Model returned no structured output' }, 502)
    }

    const parsed = JSON.parse(textBlock.text) as {
      extracted_items: { category: string; content: string; source_item_ids: string[] }[]
      flags: {
        type: string
        description: string
        evidence: string
        source_item_ids: string[]
        suggested_resolutions: string[]
      }[]
    }

    // Defensive: drop any hallucinated ids that weren't actually given to the model.
    const cleanIds = (ids: string[]) => (ids ?? []).filter((id) => knownIds.has(id))

    const sourceItemIds = sourceItems.map((item: { id: string }) => item.id)

    const { data: extraction, error: extractionError } = await userClient
      .from('extractions')
      .insert({ project_id, source_item_ids: sourceItemIds })
      .select()
      .single()

    if (extractionError || !extraction) {
      return json({ error: extractionError?.message ?? 'Could not save extraction' }, 500)
    }

    const extractedItemRows = parsed.extracted_items.map((item) => ({
      extraction_id: extraction.id,
      project_id,
      category: item.category,
      content: item.content,
      source_item_ids: cleanIds(item.source_item_ids),
    }))

    const flagRows = parsed.flags.map((flag) => ({
      extraction_id: extraction.id,
      project_id,
      type: flag.type,
      description: flag.description,
      evidence: flag.evidence,
      source_item_ids: cleanIds(flag.source_item_ids),
      suggested_resolutions: flag.suggested_resolutions ?? [],
    }))

    const [{ data: extractedItems, error: itemsError }, { data: flags, error: flagsError }] = await Promise.all([
      extractedItemRows.length > 0
        ? userClient.from('extracted_items').insert(extractedItemRows).select()
        : Promise.resolve({ data: [], error: null }),
      flagRows.length > 0
        ? userClient.from('flags').insert(flagRows).select()
        : Promise.resolve({ data: [], error: null }),
    ])

    if (itemsError || flagsError) {
      return json({ error: itemsError?.message ?? flagsError?.message }, 500)
    }

    return json({ extraction, extracted_items: extractedItems, flags })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
