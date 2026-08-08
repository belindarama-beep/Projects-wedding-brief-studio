// Mirrors approve-direction's prompt-assembly logic exactly, post-Phase-E1
// (supabase/functions/approve-direction/index.ts), against a captured data
// payload, so the assembled prompt can be diffed and grepped as a file
// rather than eyeballed from a log line.
//
// Unlike phase-c-verification/render-prompt.mjs, this DOES include the
// previousApproved block — that's exactly the mechanism Phase E1 changes.
// The payload additionally carries `previous_approved` (the latest approved
// direction_versions row) and `source_items` (every source row's
// excluded_at, used to compute the most recent exclusion timestamp), since
// the E1 rule needs both to decide whether previousApproved feeds forward.

import { readFileSync } from 'node:fs'

const CATEGORY_LABELS = {
  atmosphere: 'Atmosphere',
  formality: 'Formality',
  colour_material: 'Colour & material',
  floral_approach: 'Floral approach',
  guest_experience: 'Guest experience',
  exclusions: 'Exclusions',
}

function render(payload) {
  const {
    project,
    extracted_items: extractedItems,
    flags,
    resolutions,
    previous_approved: previousApproved,
    source_items: sourceItems,
  } = payload

  const resolutionByFlagId = new Map((resolutions ?? []).map((r) => [r.flag_id, r]))

  const promptLines = []
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

  const visibleFlags = (flags ?? []).filter((f) => !f.internal_only)
  const internalOnlyFlags = (flags ?? []).filter((f) => !!f.internal_only)

  const resolvedFlags = visibleFlags.filter((f) => {
    const r = resolutionByFlagId.get(f.id)
    return r != null && r.method !== 'kept_open'
  })
  const openFlags = visibleFlags.filter((f) => {
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
    "Still open (the planner has not resolved these — include every one of these, and only these, in contradictions/unresolved_questions; do not add any others; copy each id exactly into that entry's flag_id):",
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

  // E1 feed-forward rule (source-level-sensitivity-build-brief.md Phase E1):
  // previousApproved does not feed into the prompt if it was approved before
  // the most recent excluded_at across this project's source_items.
  const mostRecentExcludedAt = (sourceItems ?? [])
    .map((s) => s.excluded_at)
    .filter(Boolean)
    .map((t) => new Date(t).getTime())
    .reduce((max, t) => (t > max ? t : max), -Infinity)

  const previousApprovedForPrompt =
    previousApproved &&
    Number.isFinite(mostRecentExcludedAt) &&
    new Date(previousApproved.approved_at).getTime() < mostRecentExcludedAt
      ? null
      : previousApproved

  if (previousApprovedForPrompt) {
    promptLines.push('')
    promptLines.push(
      `Previous approved direction (version ${previousApprovedForPrompt.version_number}, approved ${previousApprovedForPrompt.approved_at}):`,
    )
    promptLines.push(JSON.stringify(previousApprovedForPrompt.content))
  } else {
    promptLines.push('')
    promptLines.push('This is the first approved direction for this project. There is no previous version.')
  }

  return promptLines.join('\n')
}

const inputPath = process.argv[2]
const outputPath = process.argv[3]
const payload = JSON.parse(readFileSync(inputPath, 'utf8'))
const prompt = render(payload)
process.stdout.write(
  `extracted_items: ${payload.extracted_items.length}, flags: ${payload.flags.length}, previous_approved: v${payload.previous_approved?.version_number ?? '(none)'}\n`,
)
if (outputPath) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(outputPath, prompt)
} else {
  process.stdout.write(prompt)
}
