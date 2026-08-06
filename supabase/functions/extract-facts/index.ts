// Extract stage, Phase 1 — batched fact extraction (extract-facts-timeout-brief.md, Path 3).
//
// This function now has two modes, discriminated by whether `extraction_id`
// is present in the request body:
//
// - Plan mode ({ project_id }): assigns batch_index to any source_items that
//   don't have one yet (append-only — an existing item's batch_index is
//   never touched), creates the parent `extractions` row, and returns the
//   full current batch plan so the client can drive Phase 1 one batch at a
//   time. No model call.
// - Batch mode ({ project_id, extraction_id, pool, batch_index }): runs
//   fact extraction (classified facts only, no contradiction/gap detection
//   — that's flag-facts, Phase 2) for one batch, and writes extracted_items
//   tied to extraction_id.
//
// Voice sources are explicitly out of scope for this phase; text and image
// only. Model is unchanged (claude-opus-5) — this is an architecture change,
// not the model swap gated in extract-facts-timeout-brief.md (Path 2).
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Starting points from extract-facts-timeout-brief.md (§Batch composition),
// not derived numbers — text batches can be generous, image batches stay
// small given even 3 images pushed close to the timeout ceiling. Tunable
// here as the validation pass finds out more, not meant to be load-bearing
// precision.
const TEXT_BATCH_CAPACITY = 40
const IMAGE_BATCH_CAPACITY = 2

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

const PHASE1_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['extracted_items'],
  properties: {
    extracted_items: { type: 'array', items: EXTRACTED_ITEM_SCHEMA },
  },
}

const SYSTEM_PROMPT = `You are the Extract stage for Wedding Brief Studio, a tool used by professional wedding planners.

Your job is to read a batch of collected source material for a wedding project and produce classified facts, preferences, and constraints. You are working on one batch of a larger source folder — contradiction and gap detection across the whole project happens later, in a separate pass over every batch's combined output, not here. Do not try to spot contradictions yourself; just classify what this batch's material says.

Do not invent facts that are not in the source material.

Classify every fact, preference, or constraint you extract into exactly one of these categories:
- atmosphere: the overall mood, feeling, energy of the event
- formality: how formal, casual, dressed-up, or relaxed the wedding should feel
- colour_material: colour palette, materials, fabrics, finishes
- floral_approach: floral style, forms, quantity, placement
- guest_experience: format of the day, dining style, pacing, what guests will do and feel
- exclusions: explicit dislikes, rule-outs, "not this", what to avoid

Each extracted item's "source_item_ids" must list the id(s) of the source item(s) it was drawn from — every source item you are given is labeled with its id. Do not cite an id that was not given to you.`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type SourceItemRow = {
  id: string
  type: string
  raw_content: string | null
  file_path: string | null
  added_at: string
  attribution: string | null
  batch_index: number | null
}

function poolOf(type: string): 'image' | 'text' {
  return type === 'image' ? 'image' : 'text'
}

// Assigns batch_index to items that don't have one, filling the last
// not-yet-full batch first, then opening new ones — insertion order is
// preserved by the caller's query order. Never touches an item that already
// has a batch_index. This is the append-only rule
// extract-facts-timeout-brief.md requires.
function assignBatches(
  items: SourceItemRow[],
  capacity: number,
): { id: string; batch_index: number }[] {
  const countsByBatch = new Map<number, number>()
  for (const item of items) {
    if (item.batch_index != null) {
      countsByBatch.set(item.batch_index, (countsByBatch.get(item.batch_index) ?? 0) + 1)
    }
  }
  let currentBatch = countsByBatch.size > 0 ? Math.max(...countsByBatch.keys()) : -1
  let currentCount = currentBatch >= 0 ? countsByBatch.get(currentBatch)! : capacity

  const updates: { id: string; batch_index: number }[] = []
  for (const item of items) {
    if (item.batch_index != null) continue
    if (currentBatch < 0 || currentCount >= capacity) {
      currentBatch += 1
      currentCount = 0
    }
    updates.push({ id: item.id, batch_index: currentBatch })
    currentCount += 1
  }
  return updates
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { project_id, extraction_id, pool, batch_index } = body as {
      project_id?: string
      extraction_id?: string
      pool?: 'text' | 'image'
      batch_index?: number
    }
    if (!project_id) {
      return json({ error: 'project_id is required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // Scoped to the caller's own JWT so RLS enforces "this project's own
    // rows only" without any extra checks here.
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

    // ---- Plan mode: no extraction_id given ----
    if (!extraction_id) {
      const { data: allSourceItems, error: sourceError } = await userClient
        .from('source_items')
        .select('id, type, raw_content, file_path, added_at, attribution, batch_index')
        .eq('project_id', project_id)
        .order('added_at', { ascending: true })

      if (sourceError) {
        return json({ error: sourceError.message }, 500)
      }

      const sourceItems = ((allSourceItems ?? []) as SourceItemRow[]).filter(
        (item) => item.type !== 'voice_note',
      )

      if (sourceItems.length === 0) {
        return json({ error: 'No text or image source items to extract from yet' }, 400)
      }

      const textItems = sourceItems.filter((item) => poolOf(item.type) === 'text')
      const imageItems = sourceItems.filter((item) => poolOf(item.type) === 'image')

      const textUpdates = assignBatches(textItems, TEXT_BATCH_CAPACITY)
      const imageUpdates = assignBatches(imageItems, IMAGE_BATCH_CAPACITY)
      const allUpdates = [...textUpdates, ...imageUpdates]

      if (allUpdates.length > 0) {
        const results = await Promise.all(
          allUpdates.map((u) =>
            userClient.from('source_items').update({ batch_index: u.batch_index }).eq('id', u.id),
          ),
        )
        const failed = results.find((r) => r.error)
        if (failed?.error) {
          return json({ error: failed.error.message }, 500)
        }
      }

      // Merge assigned + newly-updated batch_index to compute the final plan.
      const updatedById = new Map(allUpdates.map((u) => [u.id, u.batch_index]))
      const resolvedBatchIndex = (item: SourceItemRow) =>
        item.batch_index ?? updatedById.get(item.id)!

      const batchMap = new Map<string, number>() // key `${pool}:${batch_index}` -> count
      for (const item of sourceItems) {
        const key = `${poolOf(item.type)}:${resolvedBatchIndex(item)}`
        batchMap.set(key, (batchMap.get(key) ?? 0) + 1)
      }

      const batches = Array.from(batchMap.entries())
        .map(([key, count]) => {
          const [batchPool, idxStr] = key.split(':')
          return { pool: batchPool as 'text' | 'image', batch_index: Number(idxStr), count }
        })
        .sort((a, b) => (a.pool === b.pool ? a.batch_index - b.batch_index : a.pool.localeCompare(b.pool)))

      const sourceItemIds = sourceItems.map((item) => item.id)

      const { data: extraction, error: extractionError } = await userClient
        .from('extractions')
        .insert({ project_id, source_item_ids: sourceItemIds })
        .select()
        .single()

      if (extractionError || !extraction) {
        return json({ error: extractionError?.message ?? 'Could not create extraction' }, 500)
      }

      return json({ extraction, batches })
    }

    // ---- Batch mode: extraction_id given ----
    if (!pool || batch_index == null) {
      return json({ error: 'pool and batch_index are required in batch mode' }, 400)
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

    const typeFilter = pool === 'image' ? ['image'] : ['written_note', 'structured_field']

    const { data: batchItems, error: batchItemsError } = await userClient
      .from('source_items')
      .select('*')
      .eq('project_id', project_id)
      .eq('batch_index', batch_index)
      .in('type', typeFilter)
      .order('added_at', { ascending: true })

    if (batchItemsError) {
      return json({ error: batchItemsError.message }, 500)
    }

    const sourceItems = (batchItems ?? []) as {
      id: string
      type: string
      raw_content: string | null
      file_path: string | null
      added_at: string
      attribution: string | null
    }[]

    if (sourceItems.length === 0) {
      return json({ error: 'Batch is empty' }, 400)
    }

    const knownIds = new Set(sourceItems.map((item) => item.id))

    const imageItems = sourceItems.filter((item) => item.type === 'image' && item.file_path)
    const signedImages = await Promise.all(
      imageItems.map(async (item) => {
        const { data } = await userClient.storage.from('source-files').createSignedUrl(item.file_path!, 300)
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
    textLines.push(`This batch (${pool}). Each item is labeled with its id — use these exact ids in source_item_ids.`)

    for (const item of sourceItems) {
      if (item.type === 'image') continue
      const label = item.type === 'structured_field' ? 'Like/dislike' : 'Note'
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
          schema: PHASE1_SCHEMA,
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
    }

    // Defensive: drop any hallucinated ids that weren't actually given to the model.
    const cleanIds = (ids: string[]) => (ids ?? []).filter((id) => knownIds.has(id))

    const extractedItemRows = parsed.extracted_items.map((item) => ({
      extraction_id,
      project_id,
      category: item.category,
      content: item.content,
      source_item_ids: cleanIds(item.source_item_ids),
    }))

    const { data: extractedItems, error: itemsError } =
      extractedItemRows.length > 0
        ? await userClient.from('extracted_items').insert(extractedItemRows).select()
        : { data: [], error: null }

    if (itemsError) {
      return json({ error: itemsError.message }, 500)
    }

    return json({ extracted_items: extractedItems })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
