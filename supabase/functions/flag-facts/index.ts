// Flag stage: Phase 2 of the split described in extract-facts-timeout-brief.md
// (Path 3). Runs once per extraction, after every Phase 1 batch (extract-facts,
// batch mode) has finished — reads the *complete, combined* extracted_items
// for that extraction and finds contradictions/gaps across all of them at
// once. Text-only: this call never sees images, only the facts Phase 1
// already derived from them. That's what keeps this cheap regardless of how
// many images a project's source folder holds.
//
// A contradiction can only be found between two facts present in the same
// reasoning pass, which is exactly why this runs over the combined set from
// every batch rather than per-batch — a naive per-batch version would
// silently lose any contradiction whose two sides landed in different
// batches.
//
// Model: claude-opus-5. Per the build scope, the gate on swapping the model
// that finds contradictions follows the function that does that job, not
// the function's name — after this split, that's flag-facts, not
// extract-facts. Same pass condition applies: any future swap is gated on
// the text-only Arden & Theo regression finding the same contradictions
// with the same evidence quality.
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FLAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'description', 'evidence', 'extracted_item_ids', 'suggested_resolutions'],
  properties: {
    type: { type: 'string', enum: ['contradiction', 'gap'] },
    description: { type: 'string' },
    evidence: { type: 'string' },
    extracted_item_ids: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Ids of the extracted facts (from the list you were given) that show this contradiction or gap. A gap may have none to cite — in that case return an empty array, but still describe in "evidence" what was searched for and not found.',
    },
    suggested_resolutions: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Only when the flag genuinely reduces to 2-3 discrete, obvious options (e.g. "which linen colour"), a short label for each option. Empty array otherwise — do not force options onto an open-ended question.',
    },
  },
}

const FLAGGING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['flags'],
  properties: {
    flags: { type: 'array', items: FLAG_SCHEMA },
  },
}

const SYSTEM_PROMPT = `You are the Flag stage for Wedding Brief Studio, a tool used by professional wedding planners.

You are given classified facts, preferences, and constraints already extracted from a wedding project's collected source material — not the raw material itself. Your only job is to find contradictions and gaps across the *complete* set of facts you're given, and write flags for them. You do not resolve, soften, or choose between conflicting preferences. If the couple said two things that do not fit together, or one person's input conflicts with another's (partner vs partner, couple vs family, couple vs venue constraint), flag it and describe both sides plainly — the planner decides what to do next, not you. Never quietly pick a winner between conflicting inputs, and never blend a contradiction into a single averaged statement.

Where necessary information is simply missing (no guest count discussed, no indication of formality, a decision mentioned as unresolved), flag it as a gap rather than guessing or filling it in.

Each fact you are given is labeled with its id. For every flag (contradiction or gap), write a plain description of what the tension or gap actually is, and separately an "evidence" string that quotes or closely paraphrases the specific fact(s) that show it. Cite the relevant facts' ids in "extracted_item_ids". A gap may have no facts to cite (that is what makes it a gap) — in that case return an empty array, but still describe in "evidence" what was searched for and not found. Do not cite an id that was not given to you.

For "suggested_resolutions": most flags do not get any — leave the array empty. Only populate it when the flag genuinely reduces to a small set of concrete, mutually exclusive options that were themselves present in the facts (e.g. two named colours a couple is choosing between). Never invent an option that wasn't actually raised by someone. Open-ended questions, vague tensions, and gaps almost never qualify — when in doubt, leave it empty rather than force a false choice.

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
    const { project_id, extraction_id } = await req.json()
    if (!project_id || !extraction_id) {
      return json({ error: 'project_id and extraction_id are required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

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

    const { data: extraction, error: extractionFetchError } = await userClient
      .from('extractions')
      .select('*')
      .eq('id', extraction_id)
      .eq('project_id', project_id)
      .single()

    if (extractionFetchError || !extraction) {
      return json({ error: 'Extraction not found' }, 404)
    }

    const { data: extractedItems, error: itemsError } = await userClient
      .from('extracted_items')
      .select('*')
      .eq('extraction_id', extraction_id)

    if (itemsError) {
      return json({ error: itemsError.message }, 500)
    }

    const items = (extractedItems ?? []) as {
      id: string
      category: string
      content: string
      source_item_ids: string[]
    }[]

    // Nothing to flag against — mark complete and return, no model call.
    if (items.length === 0) {
      await userClient.from('extractions').update({ status: 'complete' }).eq('id', extraction_id)
      return json({ flags: [] })
    }

    const knownItemIds = new Set(items.map((item) => item.id))
    const sourceItemIdsByItemId = new Map(items.map((item) => [item.id, item.source_item_ids ?? []]))

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
    textLines.push(
      'Classified facts, preferences, and constraints extracted from every batch of source material for this project. Each is labeled with its id — use these exact ids in extracted_item_ids.',
    )
    for (const item of items) {
      textLines.push(`- [id: ${item.id}, ${item.category}] ${item.content}`)
    }

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: FLAGGING_SCHEMA,
        },
        // deno-lint-ignore no-explicit-any
      } as any,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: textLines.join('\n') }],
    })

    // deno-lint-ignore no-explicit-any
    const textBlock = message.content.find((b: any) => b.type === 'text') as any
    if (!textBlock) {
      return json({ error: 'Model returned no structured output' }, 502)
    }

    const parsed = JSON.parse(textBlock.text) as {
      flags: {
        type: string
        description: string
        evidence: string
        extracted_item_ids: string[]
        suggested_resolutions: string[]
      }[]
    }

    const flagRows = parsed.flags.map((flag) => {
      // Defensive: drop any hallucinated ids that weren't actually given to
      // the model, same discipline as Phase 1's id cleaning.
      const citedItemIds = (flag.extracted_item_ids ?? []).filter((id) => knownItemIds.has(id))
      // flags.source_item_ids is inherited from the cited extracted_items'
      // own provenance, not cited by the model directly — Phase 2 never
      // sees source items (or images) at all, only Phase 1's already-written
      // facts, so this is the only way the audit trail back to "this came
      // from image X" survives the split.
      const sourceItemIds = Array.from(
        new Set(citedItemIds.flatMap((id) => sourceItemIdsByItemId.get(id) ?? [])),
      )
      return {
        extraction_id,
        project_id,
        type: flag.type,
        description: flag.description,
        evidence: flag.evidence,
        source_item_ids: sourceItemIds,
        suggested_resolutions: flag.suggested_resolutions ?? [],
      }
    })

    const { data: flags, error: flagsError } =
      flagRows.length > 0
        ? await userClient.from('flags').insert(flagRows).select()
        : { data: [], error: null }

    if (flagsError) {
      return json({ error: flagsError.message }, 500)
    }

    const { error: statusError } = await userClient
      .from('extractions')
      .update({ status: 'complete' })
      .eq('id', extraction_id)

    if (statusError) {
      return json({ error: statusError.message }, 500)
    }

    return json({ flags })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
