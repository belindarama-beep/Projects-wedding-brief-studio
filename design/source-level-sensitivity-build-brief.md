# Build brief — source-level sensitivity marking

**Status:** Section 4 investigation complete and reviewed. Ready for Phase B.
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

**Retained:** the flag-level toggle stays, scoped to sensitivity that emerges from juxtaposition — where neither source is sensitive alone.

## 3. Amendments from the investigation

### 3.1 Empty `source_item_ids` arrays are holes in the mechanism

Both array columns are `NOT NULL DEFAULT '{}'` with no foreign key. The citation link is application-enforced only — `extract-facts` and `flag-facts` filter cited ids against a known-ids set before insert, but nothing at the database level requires a non-empty array.

An extracted item with an empty `source_item_ids` can never be excluded by any source marking. Silently. The derivation is exactly as trustworthy as the model's citation discipline during extraction.

**Phase B precondition:** count rows in `extracted_items` and `flags` with `source_item_ids = '{}'`, broken down by extraction. Report before building. If the count is non-zero this is a decision — fail extraction on uncited items, or surface them in the UI as unprotectable — not a detail to route around.

### 3.2 The two toggles carry different guarantees, and the UI must say so

Per 2.2. A planner looking at a flag-level `internal_only` toggle and a source-level exclusion control will reasonably assume they protect equally. They don't. Phase D copy must make the difference legible without requiring the planner to understand prompt assembly.

### 3.3 The marking control shows full raw content, not a preview

`39319398`, the actual backfill target, bundles the sensitive clause together with an unrelated logistics fact — that Theo's parents are hosting the recovery lunch and aren't involved in the design. Marking the source excludes both.

Source-level exclusion is exactly as granular as the planner's note-taking habits. Source splitting is not in scope. The mitigation is honesty at the point of decision: render the source's complete `raw_content` (or `transcribed_text`) in the marking control, untruncated. Trade-off copy is worthless if the planner can't see what they're losing.

### 3.4 Known limitation, to be acknowledged in copy rather than papered over

A planner can restate sensitive content in a free-text resolution on an unrelated flag. No mechanism catches it — the content has no traceable link back to a marked source. This is a copy problem, not a code problem.

And the primary trade-off, which must appear at the point of marking: marking a source removes it from the direction entirely, not just from the couple's view. The planner loses that material from their own document too. If the copy doesn't say so, planners will mark liberally and wonder why the direction thinned out.

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

**Phase B — schema + derivation.** First: the empty-array count from 3.1. Report and stop if non-zero. Then the migration (as a repo file in `supabase/migrations/`, committed) adding the source-level field, and the derivation view or shared helper. No consumers yet. Verify by query: mark a source in a scratch project, confirm the correct extracted items and flags read as sensitive via array overlap.

**Phase C — exclusion in `approve-direction`.** Filter at prompt assembly, on the `extracted_items` query and the flag buckets both. Verify by diffing the assembled prompt with and without a marked source — the excluded text absent from the payload, not merely from the output.

**Phase D — UI.** Marking control on `SourceRow` with untruncated raw content per 3.3; exclusion indicator on derived items; trade-off copy per 3.4; the two-guarantees distinction per 3.2. Copy comes to review before it ships.

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
