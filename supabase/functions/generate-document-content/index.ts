// Derives the AI-assisted content a document template needs beyond what's
// already in an approved direction_versions row: budget tiers for the
// creative-direction document, or a supplier-angled re-framing for the
// floral/styling brief. Read-only against Supabase; writes nothing. The
// client owns rendering, PDF capture, storage upload, and the documents
// row insert.
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'description', 'whats_included'],
  properties: {
    headline: { type: 'string' },
    description: { type: 'string' },
    whats_included: { type: 'array', items: { type: 'string' } },
  },
}

const BUDGET_TIERS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['essential', 'elevated', 'signature'],
  properties: {
    essential: TIER_SCHEMA,
    elevated: TIER_SCHEMA,
    signature: TIER_SCHEMA,
  },
}

const SUPPLIER_BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'brief_summary',
    'floral_approach',
    'colour_material_direction',
    'priority_moments',
    'practical_constraints',
    'what_to_avoid',
  ],
  properties: {
    brief_summary: { type: 'string' },
    floral_approach: { type: 'string' },
    colour_material_direction: { type: 'string' },
    priority_moments: { type: 'array', items: { type: 'string' } },
    practical_constraints: { type: 'array', items: { type: 'string' } },
    what_to_avoid: { type: 'array', items: { type: 'string' } },
  },
}

const BUDGET_TIERS_SYSTEM_PROMPT = `You are helping a wedding planner turn an already-approved creative direction into a budget-tier comparison for their client. The direction has already been reviewed and approved by the planner — your job is to interpret it into three spending tiers, not to invent new preferences or override anything in it.

Produce three tiers: essential, elevated, and signature. Each needs a short headline, a one or two sentence description of what that tier feels like, and a few concrete "what's included" bullets. The tiers must stay consistent with the approved direction's priority moments and what-to-avoid list — do not suggest anything the direction explicitly rules out, even at the signature tier. Essential should be a genuinely good, complete version of the direction at a lower spend, not a stripped-down disappointment. Signature should show where additional budget would visibly elevate the priority moments specifically, not just add generic extras.`

const SUPPLIER_BRIEF_SYSTEM_PROMPT = `You are helping a wedding planner turn an already-approved creative direction into a brief for an external floral/styling supplier. The direction has already been reviewed and approved by the planner — your job is to re-angle the already-approved facts for a supplier audience, not to add new preferences.

A florist or stylist reading this brief needs practical, usable direction: what the visual and floral approach actually is, the colour/material direction, which moments in the day matter most for florals/styling specifically, any practical constraints that affect their work (venue, weather, timing, outdoor setup), and what to explicitly avoid. Leave out anything from the direction that isn't relevant to a floral/styling supplier (e.g. dining format, budget commentary) unless it directly constrains their work.`

// The SDK's own default retry behaviour is opaque about timing, which risks
// stacking unpredictably with a caller-side retry. maxRetries: 0 on the
// client below hands full, bounded control to this instead. Only
// overloaded_error/5xx is worth retrying — anything else (bad request,
// auth) will fail the same way again.
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
    const { direction_version_id, document_type } = await req.json()
    if (!direction_version_id || !document_type) {
      return json({ error: 'direction_version_id and document_type are required' }, 400)
    }
    if (document_type !== 'creative_direction' && document_type !== 'supplier_brief') {
      return json({ error: 'document_type must be creative_direction or supplier_brief' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: direction, error: directionError } = await userClient
      .from('direction_versions')
      .select('*')
      .eq('id', direction_version_id)
      .single()

    if (directionError || !direction) {
      return json({ error: 'Direction version not found' }, 404)
    }
    if (direction.status !== 'approved') {
      return json({ error: 'Documents can only be generated from an approved direction version' }, 400)
    }

    const { data: project, error: projectError } = await userClient
      .from('projects')
      .select('*')
      .eq('id', direction.project_id)
      .single()

    if (projectError || !project) {
      return json({ error: 'Project not found' }, 404)
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: apiKey, error: secretError } = await serviceClient.rpc('get_secret', {
      secret_name: 'anthropic_api_key',
    })
    if (secretError || !apiKey) {
      return json({ error: 'Anthropic API key not configured' }, 500)
    }

    const anthropic = new Anthropic({ apiKey, maxRetries: 0 })
    // Deliberately excludes direction.content.planner_notes, contradictions,
    // and unresolved_questions — none of that is ever meant to reach a
    // client-facing or supplier-facing document.
    const directionSummary = [
      `Central idea: ${direction.content.central_idea}`,
      `Visual direction: ${direction.content.visual_direction}`,
      `Colour/material direction: ${direction.content.colour_material_direction}`,
      `Priority moments: ${direction.content.priority_moments.join('; ')}`,
      `What to avoid: ${direction.content.what_to_avoid.join('; ')}`,
      `Fixed decisions: ${direction.content.fixed_decisions.join('; ')}`,
      `Flexible decisions: ${direction.content.flexible_decisions.join('; ')}`,
      `Budget implications: ${direction.content.budget_implications}`,
      `Venue: ${project.venue ?? 'not specified'}`,
      `Guest count: ${project.guest_count ?? 'not specified'}`,
      `Stated budget: ${project.budget != null ? `$${project.budget} AUD` : 'not specified'}`,
    ].join('\n')

    // TEMPORARY: claude-opus-5 has a confirmed, live Anthropic incident
    // (degraded performance, identified Aug 5 2026 07:05 UTC, no ETA).
    // Swapped to claude-sonnet-5 as a stopgap to unblock Generate, not as
    // a permanent model decision. Revert to claude-opus-5 once
    // status.anthropic.com clears the incident. Mirrors the same stopgap
    // already applied to approve-direction.
    const model = 'claude-sonnet-5'

    let message
    if (document_type === 'creative_direction') {
      message = await withOverloadRetry(() =>
        anthropic.messages.create({
          model,
          max_tokens: 4000,
          output_config: {
            effort: 'medium',
            format: { type: 'json_schema', schema: BUDGET_TIERS_SCHEMA },
            // deno-lint-ignore no-explicit-any
          } as any,
          system: BUDGET_TIERS_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: directionSummary }],
        }),
      )
    } else {
      message = await withOverloadRetry(() =>
        anthropic.messages.create({
          model,
          max_tokens: 4000,
          output_config: {
            effort: 'medium',
            format: { type: 'json_schema', schema: SUPPLIER_BRIEF_SCHEMA },
            // deno-lint-ignore no-explicit-any
          } as any,
          system: SUPPLIER_BRIEF_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: directionSummary }],
        }),
      )
    }

    // deno-lint-ignore no-explicit-any
    const textBlock = message.content.find((b: any) => b.type === 'text') as any
    if (!textBlock) {
      return json({ error: 'Model returned no structured output' }, 502)
    }

    const content = JSON.parse(textBlock.text)
    return json({ content })
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
