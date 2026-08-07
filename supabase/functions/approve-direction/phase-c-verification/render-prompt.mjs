// Mirrors approve-direction's prompt-assembly logic exactly (lines
// ~238-308 of supabase/functions/approve-direction/index.ts, post-Phase-C),
// against a captured data payload, so the assembled prompt can be diffed
// and grepped as a file rather than eyeballed from a log line.
//
// previousApproved is deliberately omitted here — that's a separate,
// confirmed-but-unfixed leak path (see report), and including it would
// make this specific artifact's grep-returns-zero claim ambiguous about
// which mechanism a match came from. This isolates exactly what Phase C's
// filter changes: the extracted_items query and the flag buckets.

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
  const { project, extracted_items: extractedItems, flags, resolutions } = payload

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

  // Phase C: flags array is already is_excluded=false-filtered at the query
  // level (extracted_items_with_sensitivity / flags_with_sensitivity, both
  // queried with .eq('is_excluded', false)) -- so an excluded flag never
  // reaches this bucketing at all, structurally cannot land in
  // internalOnlyFlags, and this code is otherwise unchanged from before
  // Phase C.
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

  return promptLines.join('\n')
}

const inputPath = process.argv[2]
const outputPath = process.argv[3]
const payload = JSON.parse(readFileSync(inputPath, 'utf8'))
const prompt = render(payload)
process.stdout.write(`extracted_items: ${payload.extracted_items.length}, flags: ${payload.flags.length}\n`)
if (outputPath) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(outputPath, prompt)
} else {
  process.stdout.write(prompt)
}
