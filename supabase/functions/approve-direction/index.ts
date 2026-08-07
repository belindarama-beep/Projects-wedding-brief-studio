// Approve stage: assembles the latest Extract run's extracted_items plus
// whatever the planner has recorded in resolutions into a new, versioned
// direction_versions row (status: approved). This is synthesis only — it
// never identifies a new contradiction or gap; those were already found by
// Extract and either resolved or explicitly kept open by the planner. Never
// overwrites a previous direction_versions row.
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DIRECTION_CONTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'central_idea',
    'visual_direction',
    'colour_material_direction',
    'priority_moments',
    'what_to_avoid',
    'fixed_decisions',
    'flexible_decisions',
    'planner_notes',
    'contradictions',
    'unresolved_questions',
    'budget_implications',
    'budget_considerations',
    'diff',
  ],
  properties: {
    central_idea: { type: 'string' },
    visual_direction: { type: 'string' },
    colour_material_direction: { type: 'string' },
    priority_moments: { type: 'array', items: { type: 'string' } },
    what_to_avoid: { type: 'array', items: { type: 'string' } },
    fixed_decisions: { type: 'array', items: { type: 'string' } },
    flexible_decisions: { type: 'array', items: { type: 'string' } },
    planner_notes: { type: 'array', items: { type: 'string' } },
    contradictions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'description', 'flag_id'],
        properties: {
          topic: { type: 'string' },
          description: { type: 'string' },
          flag_id: { type: 'string' },
        },
      },
    },
    unresolved_questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'context', 'flag_id'],
        properties: {
          question: { type: 'string' },
          context: { type: 'string' },
          flag_id: { type: 'string' },
        },
      },
    },
    budget_implications: { type: 'string' },
    budget_considerations: { type: 'array', items: { type: 'string' } },
    diff: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['is_directional_shift', 'summary', 'changes'],
          properties: {
            is_directional_shift: { type: 'boolean' },
            summary: { type: 'string' },
            changes: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['area', 'before', 'after'],
                properties: {
                  area: { type: 'string' },
                  before: { type: 'string' },
                  after: { type: 'string' },
                },
              },
            },
          },
        },
      ],
    },
  },
}

const SYSTEM_PROMPT = `You are the Approve stage for Wedding Brief Studio, a tool used by professional wedding planners.

Your job is synthesis only, not interpretation. You are given already-classified extracted facts/preferences/constraints, and a list of flags (contradictions and gaps) that have each already been through one of two things: the planner resolved them (you are told exactly how), or the planner explicitly decided to keep them open. You do not identify any new contradiction or gap beyond what you are given, and you do not second-guess or revisit a resolution the planner already made — write it up faithfully as a locked-in decision.

Write the approved creative direction:
- central_idea, visual_direction, colour_material_direction: synthesized prose, grounded only in the extracted items and resolved decisions you were given.
- priority_moments, what_to_avoid, fixed_decisions, flexible_decisions: pull from the extracted items and resolved flags. A resolved contradiction becomes a fixed_decision (it is no longer in question). Do not put a resolved item in both fixed_decisions and contradictions.
- contradictions: only the flags marked "still open" (in the "Still open" list below, never from "Internal only") that are of type contradiction, written up as {topic, description, flag_id} — flag_id must be copied exactly, character for character, from that flag's id in the list. Do not add others, do not drop any of these.
- unresolved_questions: only the flags marked "still open" (in the "Still open" list below, never from "Internal only") that are of type gap, written up as {question, context, flag_id} — flag_id must be copied exactly, character for character, from that flag's id in the list. Do not add others, do not drop any of these.
- budget_implications: a short synthesis of ONLY what is directly traceable to a specific extracted item or a resolution — confirmed figures, the stated pressure point between competing priorities, what has actually been resolved. Do not infer or extrapolate a downstream operational consequence that nothing in the extracted material or a resolution actually stated (for example, whether a seating choice might affect catering labour, or whether a print run counts as cheap or expensive) — that kind of reasonable-but-unstated inference belongs in budget_considerations instead, never blended into this field.
- budget_considerations: operational or practical consequences you can reasonably infer from the extracted material and resolved decisions, but that are not themselves directly stated or resolved — this is where the kind of connection budget_implications must not make belongs instead (e.g. "reduced service aisles may affect catering service labour", "two-colour stationery is a modest print cost"). This field is planner-facing only and is never shown to the couple, so useful inference is welcome here specifically because it is clearly separated from what's traceable. Empty array if there is nothing worth inferring.
- planner_notes: anything that reads as private, confidential, or said in confidence by only one partner (e.g. one partner asking you not to raise something with the other, private financial detail) must go here instead of the couple-facing fields above. For flags in the "Still open" or "Resolved" lists, it is fine and often necessary to still name the underlying tension in contradictions/unresolved_questions/fixed_decisions, phrased without repeating anything said in confidence.

  Flags listed under "Internal only" are different, and stricter: their entire subject matter is unsafe for a couple to read about themselves, however softened, generalized, or anonymized the phrasing. Never reference an internal-only flag, or anything derived from it, anywhere in the generated record — not in any field, not even a vague or generic version of the underlying tension, and not only in the fields most obviously about contradictions or decisions. A narrative field like central_idea, visual_direction, colour_material_direction, priority_moments, or what_to_avoid is just as capable of carrying a sentence about who is funding what, or a family disagreement, as a fixed_decision is — the prohibition is on the content reaching the couple, not on which field it travels in. Summarize each one (including its resolution, if it has one) only in planner_notes, in plain language, so the planner has the context without it ever reaching a couple- or supplier-facing field.

None of the couple-facing fields — central_idea, visual_direction, colour_material_direction, priority_moments, what_to_avoid, fixed_decisions, flexible_decisions, budget_implications — may ever reference planner_notes, "the planner," or any other internal-only field as somewhere the reader could look for more information. The couple cannot see those fields. Pointing them there is wrong on its own terms, independent of whether the underlying topic itself would be safe to mention.

If you are given a previous approved direction, also produce a diff: a plain-language summary of what changed, whether this is a genuine directional shift ("is_directional_shift") versus just resolution/addition, and specific before/after changes by area. If there is no previous approved direction, set "diff" to null.`

// The SDK's own default retry behaviour is opaque about timing, which risks
// stacking unpredictably with a caller-side retry and blowing the 150s
// function wall-clock ceiling. maxRetries: 0 on the client below hands full,
// bounded control to this instead. Only overloaded_error/5xx is worth
// retrying — anything else (bad request, auth) will fail the same way again.
// A single successful call already legitimately takes 60-90s, so this can
// only absorb a brief blip, not a sustained multi-minute overload — that's
// a real limit of retrying inside one function invocation, not a gap in
// this logic.
async function withOverloadRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status !== 529 && !(typeof status === 'number' && status >= 500)) throw err
    await new Promise((resolve) => setTimeout(resolve, 5000))
    return await fn()
  }
}

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

    const { data: latestExtraction, error: extractionError } = await userClient
      .from('extractions')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (extractionError) {
      return json({ error: extractionError.message }, 500)
    }
    if (!latestExtraction) {
      return json({ error: 'No extraction has been run for this project yet' }, 400)
    }

    // Server-side, not just a UI gate a direct call could bypass — see
    // flag-resolution-carry-forward-build-brief.md's HOLD note. Set via
    // extractions.blocked, not inferred from flags: a flag's internal_only
    // status is exactly what this hold exists because of not trusting.
    if (latestExtraction.blocked) {
      return json(
        {
          error:
            latestExtraction.blocked_reason ??
            'This extraction is blocked from approval.',
        },
        403,
      )
    }

    // Source-level sensitivity marking (source-level-sensitivity-build-brief.md).
    // Querying the derivation views with is_excluded=false means an excluded
    // extracted_item or flag is never fetched at all — not filtered out
    // after the fact, not routed into internalOnlyFlags below. There is no
    // later point in this function where an excluded flag could end up in
    // any of the three buckets (resolved/open/internal-only), because it
    // was never in `flags` to begin with. That's deliberate: internalOnlyFlags
    // is read into the prompt (to inform planner_notes), which is exactly
    // what a source-level exclusion must never do.
    const [{ data: extractedItems, error: itemsError }, { data: flags, error: flagsError }] = await Promise.all([
      userClient
        .from('extracted_items_with_sensitivity')
        .select('*')
        .eq('extraction_id', latestExtraction.id)
        .eq('is_excluded', false),
      userClient
        .from('flags_with_sensitivity')
        .select('*')
        .eq('extraction_id', latestExtraction.id)
        .eq('is_excluded', false),
    ])

    if (itemsError || flagsError) {
      return json({ error: itemsError?.message ?? flagsError?.message }, 500)
    }

    const flagIds = (flags ?? []).map((f: { id: string }) => f.id)
    const { data: resolutions, error: resolutionsError } =
      flagIds.length > 0
        ? await userClient.from('resolutions').select('*').in('flag_id', flagIds)
        : { data: [], error: null }

    if (resolutionsError) {
      return json({ error: resolutionsError.message }, 500)
    }

    const resolutionByFlagId = new Map(
      (resolutions ?? []).map((r: { flag_id: string }) => [r.flag_id, r]),
    )

    const { data: previousApproved } = await userClient
      .from('direction_versions')
      .select('*')
      .eq('project_id', project_id)
      .eq('status', 'approved')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const CATEGORY_LABELS: Record<string, string> = {
      atmosphere: 'Atmosphere',
      formality: 'Formality',
      colour_material: 'Colour & material',
      floral_approach: 'Floral approach',
      guest_experience: 'Guest experience',
      exclusions: 'Exclusions',
    }

    const promptLines: string[] = []
    promptLines.push(`Project: ${project.couple_names ?? 'Untitled'}`)
    if (project.venue) promptLines.push(`Venue: ${project.venue}`)
    if (project.wedding_date) promptLines.push(`Date: ${project.wedding_date}`)
    if (project.guest_count != null) promptLines.push(`Guest count: ${project.guest_count}`)
    if (project.budget != null) promptLines.push(`Budget: $${project.budget} AUD`)

    promptLines.push('')
    promptLines.push('Extracted items:')
    for (const item of extractedItems ?? []) {
      promptLines.push(`- [${CATEGORY_LABELS[item.category] ?? item.category}] ${item.content}`)
    }

    // internal_only flags never reach a couple-facing field, resolved or not —
    // their subject matter is inherently unsafe to reference, not just the
    // fact that they're currently unresolved.
    const visibleFlags = (flags ?? []).filter((f: { internal_only?: boolean }) => !f.internal_only)
    const internalOnlyFlags = (flags ?? []).filter((f: { internal_only?: boolean }) => !!f.internal_only)

    // A flag with no resolution row at all is treated the same as an
    // explicit "kept_open" one — not resolved, so it stays open.
    const resolvedFlags = visibleFlags.filter((f: { id: string }) => {
      const r = resolutionByFlagId.get(f.id)
      return r != null && r.method !== 'kept_open'
    })
    const openFlags = visibleFlags.filter((f: { id: string }) => {
      const r = resolutionByFlagId.get(f.id)
      return r == null || r.method === 'kept_open'
    })

    promptLines.push('')
    promptLines.push('Resolved (write these up as locked-in decisions, not as open contradictions/questions):')
    for (const flag of resolvedFlags) {
      const resolution = resolutionByFlagId.get(flag.id)
      promptLines.push(
        `- [id: ${flag.id}] [${flag.type}] ${flag.description} — Resolved (${resolution.method}): ${resolution.content}`,
      )
    }
    if (resolvedFlags.length === 0) promptLines.push('(none)')

    promptLines.push('')
    promptLines.push(
      'Still open (the planner has not resolved these — include every one of these, and only these, in contradictions/unresolved_questions; do not add any others; copy each id exactly into that entry\'s flag_id):',
    )
    for (const flag of openFlags) {
      promptLines.push(`- [id: ${flag.id}] [${flag.type}] ${flag.description} — Evidence: ${flag.evidence ?? ''}`)
    }
    if (openFlags.length === 0) promptLines.push('(none)')

    promptLines.push('')
    promptLines.push(
      'Internal only (NEVER put these, or any softened/generic reference to them, anywhere in the generated record — not in any field — summarize in planner_notes only):',
    )
    for (const flag of internalOnlyFlags) {
      const resolution = resolutionByFlagId.get(flag.id)
      const status =
        resolution && resolution.method !== 'kept_open'
          ? `Resolved (${resolution.method}): ${resolution.content}`
          : 'Not resolved'
      promptLines.push(`- [id: ${flag.id}] [${flag.type}] ${flag.description} — ${status}`)
    }
    if (internalOnlyFlags.length === 0) promptLines.push('(none)')

    // KNOWN GAP, confirmed not fixed here (source-level-sensitivity-build-brief.md
    // Phase C report): this is a third, separate path into the prompt that the
    // is_excluded filtering above does not touch. previousApproved.content is a
    // stored artifact from a prior run — if a source gets marked *after* that
    // version was approved, its content (including planner_notes) still gets
    // JSON-stringified back in here on every subsequent approval. Confirmed live
    // on Arden & Theo: v13's planner_notes already contains the sensitive
    // material this build's marking is meant to keep out of the prompt.
    if (previousApproved) {
      promptLines.push('')
      promptLines.push(
        `Previous approved direction (version ${previousApproved.version_number}, approved ${previousApproved.approved_at}):`,
      )
      promptLines.push(JSON.stringify(previousApproved.content))
    } else {
      promptLines.push('')
      promptLines.push('This is the first approved direction for this project. There is no previous version.')
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: apiKey, error: secretError } = await serviceClient.rpc('get_secret', {
      secret_name: 'anthropic_api_key',
    })
    if (secretError || !apiKey) {
      return json({ error: 'Anthropic API key not configured' }, 500)
    }

    const anthropic = new Anthropic({ apiKey, maxRetries: 0 })
    const message = await withOverloadRetry(() =>
      anthropic.messages.create({
        // TEMPORARY: claude-opus-5 has a confirmed, live Anthropic incident
        // (degraded performance, identified Aug 5 2026 07:05 UTC, no ETA).
        // Swapped to claude-sonnet-5 as a stopgap to unblock Approve, not as
        // the permanent model decision scoped in extract-facts-timeout-brief.md
        // Path 2 (which requires a quality pass-condition first). Revert to
        // claude-opus-5 once status.anthropic.com clears the incident.
        model: 'claude-sonnet-5',
        max_tokens: 8000,
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: DIRECTION_CONTENT_SCHEMA,
          },
          // deno-lint-ignore no-explicit-any
        } as any,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptLines.join('\n') }],
      }),
    )

    // deno-lint-ignore no-explicit-any
    const textBlock = message.content.find((b: any) => b.type === 'text') as any
    if (!textBlock) {
      return json({ error: 'Model returned no structured output' }, 502)
    }

    const parsed = JSON.parse(textBlock.text) as Record<string, unknown> & { diff: unknown }
    const { diff, ...content } = parsed

    // Referential-integrity backstop: even though the prompt instructs the
    // model to draw contradictions/unresolved_questions only from openFlags,
    // don't just trust that — drop anything whose flag_id doesn't match a
    // known, currently-open, non-internal-only flag. A slightly incomplete
    // list is fine; a leaked one is not.
    const openFlagIds = new Set(openFlags.map((f: { id: string }) => f.id))
    // deno-lint-ignore no-explicit-any
    const rawContent = content as any
    if (Array.isArray(rawContent.contradictions)) {
      rawContent.contradictions = rawContent.contradictions.filter((c: { flag_id?: string }) =>
        openFlagIds.has(c.flag_id ?? ''),
      )
    }
    if (Array.isArray(rawContent.unresolved_questions)) {
      rawContent.unresolved_questions = rawContent.unresolved_questions.filter((q: { flag_id?: string }) =>
        openFlagIds.has(q.flag_id ?? ''),
      )
    }

    const nextVersionNumber = previousApproved ? previousApproved.version_number + 1 : 1

    const { data: newVersion, error: insertError } = await userClient
      .from('direction_versions')
      .insert({
        project_id,
        version_number: nextVersionNumber,
        content,
        diff_from_previous: diff,
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError || !newVersion) {
      return json({ error: insertError?.message ?? 'Could not save approved direction' }, 500)
    }

    return json({ direction_version: newVersion })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 529 || (typeof status === 'number' && status >= 500)) {
      return json(
        { error: "Anthropic's API is currently overloaded, even after one retry. This isn't specific to this project or this change — it usually clears within a few minutes. Try again shortly." },
        503,
      )
    }
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
