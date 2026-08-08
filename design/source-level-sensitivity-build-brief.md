# Build brief — source-level sensitivity marking

**Status:** Phases A, B, C, D complete. Phase D copy reviewed and revised before shipping (tooltips replaced with confirmation-gated panels on the mark actions only; jargon swept per the core engine spec's translation table; client-side `is_excluded` made transitional with the view as source of truth). Ready for Phase E, pending separate go-ahead.
**Branch:** cut from `main`
**Blocks:** release of the hold on extraction `3579e5a0`; everything downstream of Approve
**Related:** `flag-resolution-carry-forward-build-brief.md` (carries the HOLD note)

**Revision note:** this version supersedes the pre-investigation draft. Three things changed: the backfill target was corrected from "two flags" to one source, a migration-hygiene precondition was added ahead of Phase B, and three amendments were folded in from findings in the report (Sections 3.1–3.3).

---

## 1. The problem this fixes

Planner decisions and markings are recorded at the stage where they're made and never reach the stage that needs them. Five instances of one pattern: resolutions, `internal_only` on flags, image selections, and sensitivity at `extracted_items`.

The investigation quantified this on real data, and the number is the argument: six flags are currently marked `internal_only`, across four extractions, and they trace back to one underlying source. The planner marked the same fact four separate times because `flags.id` is `gen_random_uuid()` with no id supplied on insert, so every Extract run produces new flags and the mark evaporates. Confirmed by the same investigation: `extracted_items.id` regenerates identically. `source_items.id` never does — `extract-facts` and `flag-facts` only ever `select`/`update` that table. It is the only stable anchor of the three.

The live case: a private clause ("Arden does not want her mother making styling decisions") exists only in an `extracted_item`. `approve-direction` queries `extracted_items` with no filter of any kind — not instruction-level, not structural — and pastes every row into the prompt. Approval on `3579e5a0` is blocked four ways pending this build.

## 2. The design, stated up front

Three decisions are made. Claude Code implements them; it does not re-litigate them.

### 2.1 Derivation, not materialisation

An extracted item is sensitive iff any source in its `source_item_ids` is marked. A flag is sensitive iff any source in its `source_item_ids` is marked. Computed at read time — a database view or a single shared helper — never a column written at extraction time.

Both `extracted_items.source_item_ids` and `flags.source_item_ids` are plain `uuid[]` columns with no FK, so derivation is an array-overlap test (`&&`) against the set of marked source ids. Materialising the mark downstream reintroduces the exact failure this build removes: a source marked after extraction would not propagate, and re-extraction would wipe it. If performance tempts the implementation toward a stored column, raise it — do not take it.

### 2.2 Exclusion, not instruction

`approve-direction` filters sensitive content out before prompt assembly. It does not receive the content plus an instruction to avoid it.

The report confirmed why this distinction is load-bearing. Path 3 of the current prompt assembly deliberately includes `internalOnlyFlags` description and evidence text so the model can summarise it into `planner_notes` — informing the direction requires presence, so flag-level protection is instruction-level and structurally has to be. Source marking is structural: the text never enters the context. These are two different strengths of guarantee. See 3.2.

### 2.3 Naming — needs an explicit call, and the case has strengthened

`flags.internal_only` means inform the direction but don't restate it to the couple — an instruction-level guarantee. A marked source means this content never reaches the model at all — a structural one. Same word would imply the same strength, and they are not the same strength.

Recommendation: distinct name at source level (`exclude_from_direction`, or similar), `flags.internal_only` semantics untouched. Final call is yours; make it before the migration is written.

**Retained, as a principle, not a pair of special cases:** the flag-level toggle covers sensitivity that exists at the flag level and nowhere below it. Juxtaposition-emergent sensitivity (neither source is sensitive alone, the combination a flag makes explicit is) and zero-citation gaps (§3.1 — nothing to derive from at all) are two instances of that principle, not two separately-justified exceptions. Written as a principle rather than an enumeration because it also covers whatever third instance neither the report nor this brief has thought of yet — that's the point of naming the principle instead of the list.

## 3. Amendments from the investigation

### 3.1 Empty `source_item_ids` arrays are holes in the mechanism

Both array columns are `NOT NULL DEFAULT '{}'` with no foreign key. The citation link is application-enforced only — `extract-facts` and `flag-facts` filter cited ids against a known-ids set before insert, but nothing at the database level requires a non-empty array.

An extracted item with an empty `source_item_ids` can never be excluded by any source marking. Silently. The derivation is exactly as trustworthy as the model's citation discipline during extraction.

**Phase B precondition:** count rows in `extracted_items` and `flags` with `source_item_ids = '{}'`, broken down by extraction. Report before building. If the count is non-zero this is a decision — fail extraction on uncited items, or surface them in the UI as unprotectable — not a detail to route around.

**Measured, 2026-08-06: `extracted_items` — 0 of 198, every extraction. `flags` — 1 of 106**, a single `type: 'gap'` flag ("No dietary requirements, accessibility needs, or children/plus-one policy discussed") whose empty citation is by design, not a lapse — both edge functions' system prompts explicitly permit a gap to cite nothing, since a gap is an absence, there's nothing to point at. This is the finding that actually mattered: `extracted_items` is the path with no fallback at all — it goes into `approve-direction`'s prompt directly, no per-item toggle exists, derivation is the only mechanism. Zero empty citations there is what let this build proceed to the migration without a redesign.

**Do not read 1-in-106 as "rare, therefore safe."** That's the base rate of zero-citation gaps in general, which says nothing about the rate of *sensitive* zero-citation gaps specifically — that number is unobservable until one occurs. Treat the category as live, not marginal, going forward.

**The asymmetry, named rather than smoothed over:** for a zero-citation gap, the only available protection is the flag-level toggle — the instruction-level guarantee (2.2), not the structural one. The one case source-level marking cannot reach is also the case that falls back to the weaker of the two. Not fixable inside this build's scope; recorded here so it's a known limitation, not something discovered later by someone reading the code.

### 3.2 The two toggles carry different guarantees, and the UI must say so

Per 2.2. A planner looking at a flag-level `internal_only` toggle and a source-level exclusion control will reasonably assume they protect equally. They don't. Phase D copy must make the difference legible without requiring the planner to understand prompt assembly.

### 3.3 The marking control shows full raw content, not a preview

`39319398`, the actual backfill target, bundles the sensitive clause together with an unrelated logistics fact — that Theo's parents are hosting the recovery lunch and aren't involved in the design. Marking the source excludes both.

Source-level exclusion is exactly as granular as the planner's note-taking habits. Source splitting is not in scope. The mitigation is honesty at the point of decision: render the source's complete `raw_content` (or `transcribed_text`) in the marking control, untruncated. Trade-off copy is worthless if the planner can't see what they're losing.

### 3.4 Known limitation, to be acknowledged in copy rather than papered over

A planner can restate sensitive content in a free-text resolution on an unrelated flag. No mechanism catches it — the content has no traceable link back to a marked source. This is a copy problem, not a code problem.

And the primary trade-off, which must appear at the point of marking: marking a source removes it from the direction entirely, not just from the couple's view. The planner loses that material from their own document too. If the copy doesn't say so, planners will mark liberally and wonder why the direction thinned out.

### 3.5 Open question for Phase D, deferred — not built now

The flag-level toggle's current behaviour (unchanged by this build, per §2.3) includes the marked flag's description/evidence in `approve-direction`'s prompt so the model can summarise it into `planner_notes` — inclusion is required for that to work. For the juxtaposition case that's necessary: the sensitivity only exists in the combination, and the model needs to see it to know what to leave out downstream.

For a zero-citation gap (§3.1), that reason doesn't apply — there's no combination to summarise, no downstream field that needs the model to have seen it. Full exclusion (never entering the prompt, same guarantee as source-level marking) may be available for this specific sub-case where it structurally isn't for the juxtaposition one. Not designed or built here — flagged so it survives to Phase D rather than being decided implicitly by reusing the existing toggle behaviour unexamined.

## 4. Investigation — complete

Section 4 of the prior version is discharged. The findings that constrain the build are folded into Sections 1–3 and 5 above and below. Recorded here so nothing is re-investigated:

- `source_item_ids` is `uuid[]` on both `extracted_items` and `flags`; no join table, no FK, application-enforced only
- `extracted_items.id` and `flags.id` both regenerate per run; `source_items.id` is stable
- `flags.internal_only boolean NOT NULL DEFAULT false`; read sites in `approve-direction/index.ts` (260–264), `src/app/project/document/[id]/page.tsx` (53–75), `src/app/project/page.tsx` (104, 123–133), `src/components/ExtractionView.tsx` (219–232, 275, 372/385, 472/488/493), `src/lib/types.ts` (74)
- `approve-direction` queries `extracted_items` by `extraction_id` with no filter — the ungated leak path
- No sensitivity-adjacent column exists today on `source_items` or `extracted_items` under any name
- Hold enforcement: `extractions.blocked` / `blocked_reason`; server check at `approve-direction/index.ts` 191–204; UI at `ExtractionView.tsx` 361–370 and 398–406
- Marking control belongs on `SourceRow` in `src/components/CollectView.tsx` (line 230); exclusion indicator in the `itemsByCategory` render block of `ExtractionView.tsx` (from 337)

## 5. Build phases, with review stops

Stop for review at the end of each. Do not run phases together.

**Phase A — migration filename reconciliation.** Separate commit, before anything else. The three session migrations have local filenames whose version prefix doesn't match the applied ledger (`20260806014619` local vs `20260806014650` applied, and one name string differs: `backfill_extractions_complete` vs `backfill_existing_extractions_complete`). Content matches; only the identifiers drifted, because `apply_migration` assigns the version server-side at apply time.

Rename the local files to match the applied ledger exactly. Never edit the ledger. This lands as its own commit touching nothing else. Rationale: the Supabase CLI reconciles by filename version against the ledger, so it would read these as unapplied and re-run them. Three files is a rename; thirty is an incident. It is also a precondition for the parked deploy workflow being able to do anything useful.

The twelve pre-06-Aug orphan migrations stay out of scope — different problem, no repo file to rename.

**Done.** Preserved apply order (`014650` → `014659` → `195654` still ascending — the one way a version-prefix rename could have quietly broken things, checked, didn't).

**Phase B — schema + derivation.** First: the empty-array count from 3.1. Report and stop if non-zero. Then the migration (as a repo file in `supabase/migrations/`, committed) adding the source-level field, and the derivation view or shared helper. No consumers yet. Verify by query: mark a source in a scratch project, confirm the correct extracted items and flags read as sensitive via array overlap.

**Done.** Empty-array count: `extracted_items` 0/198 (the path with no fallback — this is the result that mattered), `flags` 1/106 (a zero-citation gap, by design, see 3.1). Field named `source_items.exclude_from_direction boolean NOT NULL DEFAULT false`, with `excluded_at timestamptz` and `excluded_note text` as companions. Derivation as two views, `extracted_items_with_sensitivity` and `flags_with_sensitivity`, both `security_invoker = true` (without it, a view runs as its owner and can silently bypass RLS — checked, not assumed, given this build's whole subject is access control). Verified against a scratch project (Sam & Priya, not Arden & Theo): marked one source, inserted one extracted_item and one flag citing it plus one extracted_item citing an unmarked source, confirmed `is_excluded` computed correctly through both views, cleaned up after — zero leftover rows, source unmarked.

**Phase C — exclusion in `approve-direction`.** Filter at prompt assembly, on the `extracted_items` query and the flag buckets both. Verify by diffing the assembled prompt with and without a marked source — the excluded text absent from the payload, not merely from the output.

**Done.** `approve-direction` now queries `extracted_items_with_sensitivity` / `flags_with_sensitivity` with `.eq('is_excluded', false)` instead of the raw tables — an excluded row is never fetched, so it structurally cannot land in `internalOnlyFlags` or any other bucket; there is no later filtering step to get wrong. Verified as a captured artifact, not a log scan: rendered the real assembled prompt for Arden & Theo's extraction `3579e5a0` twice — source `39319398` unmarked, then marked (and immediately unmarked again after capture, live project left unmodified) — and diffed the two files. The diff removed exactly 3 lines (the one extracted_item citing the source, plus a contradiction and a gap flag that also cited it — the gap wasn't the one flagged in the original backfill analysis, but the array-overlap mechanism caught it correctly regardless, which is the point of deriving rather than hand-listing). `grep -c` for "does not want her mother making styling decisions": 1 match unmarked, 0 marked. Broader check, `grep -c "mother"`: 0 in the marked prompt — not just the phrase, the topic doesn't surface at all. Tooling for reproducing this lives in `supabase/functions/approve-direction/phase-c-verification/`; the captured data itself is deliberately not committed (see that directory's README) — it's Arden & Theo's real sensitive material by construction.

**Confirmed, not fixed, per scope:** `previousApproved.content` is a third, separate path into the prompt that this filtering doesn't touch — a stored JSON artifact from a prior approval, pasted back in on every subsequent run regardless of what gets marked afterward. Checked directly, not assumed: all 13 of Arden & Theo's existing approved `direction_versions` mention the mother/funding topic; several, including the latest (v13), contain "styling decisions" verbatim — confined to `planner_notes` in v13 specifically (not leaked into a couple-facing field this time), but stored, and due to re-enter the prompt on the very next approval once the hold on `3579e5a0` lifts. Left as a `KNOWN GAP` comment in `index.ts` at the `previousApproved` block, not silently absorbed into Phase C's scope.

**Phase D — UI.** Marking control on `SourceRow` with untruncated raw content per 3.3; exclusion indicator on derived items; trade-off copy per 3.4; the two-guarantees distinction per 3.2. Resolve the open question in 3.5 (full exclusion for zero-citation gaps) before touching the flag-level toggle's prompt-inclusion behaviour, if this phase goes there at all. Copy comes to review before it ships.

**Done.** §3.5 left open as instructed, not resolved — the flag-level toggle's prompt-inclusion behaviour is untouched.

`SourceRow` (`CollectView.tsx`): untruncated `raw_content`/`transcribed_text` renders unconditionally per 3.3 (already did, pre-Phase D). The mark action (not unmark) now opens a confirmation panel carrying the full trade-off copy, next to the note's own content already visible above it, instead of a hover tooltip — hover-dependent copy is absent on touch and easy to miss. Unmarking stays a single direct click. The marked state itself shows one short persistent line ("Excluded from the direction entirely.") — state, not explanation; the explanation lives in the confirmation panel where the decision is actually made.

`ExtractionView.tsx`: excluded items in `itemsByCategory` render struck through and dimmed with an "Excluded from direction" badge, not hidden — commented with the reasoning (hiding would let the direction thin out invisibly, the exact failure the trade-off copy warns against). The §3.5 residual copy near the flag-level "Mark internal-only" toggle got the same tooltip-to-confirmation treatment as the source control, gated on the mark action only.

Copy swept for internal vocabulary leaking into planner-facing text, per the core engine spec's translation table: "which only asks the writer not to repeat it" → "which only asks the system to leave it out of the wording" (an unexplained "the writer" reads as a person, in a product whose principle is the system organises, the planner decides); "not just this record" → "not just the approved creative direction" (table: Approved Record → "the approved creative direction ('Version 2.0')"); "back in your source list" → "back in the source folder" (matches `CollectView`'s actual heading, "Add to the source folder," and the spec's own Source row, "in the folder" — not invented).

Fixed a real §2.1 violation caught in review before it shipped: `ExtractionView.tsx`'s `handleRun` was computing `is_excluded` client-side from in-memory `sources` as if that were authoritative — a second, hand-written copy of the view's array-overlap rule. Left in place only as a transitional stopgap (commented as such, naming the view as the actual source of truth) to avoid a blank indicator in the instant between the run finishing and the fetch landing, then immediately overwritten by a re-fetch through `extracted_items_with_sensitivity` once the extraction completes. If the two definitions ever drift, the client-side one is what a planner would see and wrongly trust — the re-fetch is what keeps that from being possible.

`npx tsc --noEmit` and `npx eslint` clean on both touched files. Not built, per explicit scope: `previousApproved.content` (still just the `KNOWN GAP` comment from Phase C) and the §3.5 full-exclusion question. Phase E backfill still holds.

**Phase E — backfill.** Mark `39319398` only. Not the five sources the six flags collectively cite. The other four (`e30892da`, `23e8a816`, `a6bafa23`, `a6245660`) appear as the other side of each contradiction — evidence citation, not sensitivity. `a6245660` alone is cited by at least eleven extracted items across the project's full history (guest count, venue, palette, metal finish, rule-outs); marking it would strip confirmed decisions from every future direction. `39319398` is cited by exactly one extracted item per extraction — clean, narrow, correct.

Produce a report of everything `39319398` now excludes before confirming.

Hold release on `3579e5a0` is not part of this build. After A–E, as a separate deliberate `UPDATE`, once a regenerated direction has been diffed and confirmed clean.

## 6. Validation harness

The text-only Arden & Theo set (~86s), not the full set. Two reasons: the full set puts Phase 2 at 151.23s against a 150s ceiling, and the text-only set is already the committed gate for any model change on `flag-facts`. Same run does both jobs.

The test that matters: mark a source, re-run extraction so flags and extracted items regenerate with new ids, confirm derived sensitivity is still correct. That is the entire point of the build and the only test that proves it.

## 7. Explicitly out of scope

Do not touch, do not fix while you're here:

- Phase 2 timing, batch capacities, any batching redesign
- Reverting the `claude-sonnet-5` swap and `withOverloadRetry` on `approve-direction` / `generate-document-content` — separate job, do not bundle
- Any model swap on `flag-facts` — the gate stands
- Source splitting (3.3 notes the granularity limit; the answer is copy, not schema)
- Backfilling the twelve orphan migrations — distinct from the Phase A rename
- Deploy workflow, PDF export, image selection reaching Extract, couple-facing Update cycle
- Supplier Brief page-by-page review
- Changing flag-level `internal_only` behaviour beyond leaving it intact
- Phase 2 component extraction
- Deleting the three `claude/*` branches

## 8. Kickoff prompt — paste this

> Continuing work on the Wedding Brief Studio engine. Read `design/source-level-sensitivity-build-brief.md` in full. It has been revised since your investigation — Section 4 is discharged, and three amendments plus a corrected backfill target are folded in. Read the revision note.
>
> Start with Phase A only: rename the three local migration files in `supabase/migrations/` so their version prefix and name string match the applied ledger exactly. Do not edit the ledger. Do not touch migration content. Commit as its own commit, touching nothing else, and stop.
>
> Then, on approval, Phase B, and within Phase B run the empty-array count first (Section 3.1) and stop before writing the migration if the count is non-zero.
>
> Do not run phases together. Do not touch anything in Section 7. If anything in the brief conflicts with what's in the repo, raise the conflict rather than resolving it yourself.
