# Build brief — source-level sensitivity marking

**Status:** ready to hand to Claude Code
**Branch:** cut from `main`
**Blocks:** release of the hold on extraction `3579e5a0`; everything downstream of Approve
**Related:** `flag-resolution-carry-forward-build-brief.md` (carries the HOLD note)

---

## 1. The problem this fixes

Planner decisions and markings are recorded at the stage where they're made and never reach the stage that needs them. Five instances of one pattern: resolutions, `internal_only` on flags, image selections, and sensitivity at `extracted_items`. Flags are regenerated with new IDs on every extraction run, so anything attached to them evaporates.

`source_items` is the only entity with stable identity across runs. Sensitivity therefore attaches there, and everything downstream is derived, never separately recorded.

The live case: a private clause ("Arden does not want her mother making styling decisions") exists only in an `extracted_item`. `approve-direction` reads extracted items unfiltered. Approval on `3579e5a0` is blocked four ways pending this build.

## 2. The design, stated up front

Three decisions are already made. Claude Code implements them; it does not re-litigate them.

### 2.1 Derivation, not materialisation

An extracted item is sensitive iff any source it came from is marked. A flag is sensitive iff any of its evidence items is sensitive. This is computed at read time — a database view or a single shared helper — not a column written at extraction time.

Materialising the mark onto `extracted_items` or `flags` at extraction time reintroduces the exact failure this build exists to remove: a source marked after extraction would not propagate, and re-extraction would wipe it. If the implementation is tempted toward a stored column for performance, that is a trade-off to raise, not to take.

### 2.2 Exclusion, not instruction

`approve-direction` filters sensitive content out of the prompt before assembly. It does not receive the content plus an instruction to avoid it. The funding leak in `budget_implications` and the prose backstop that can't be extended past `contradictions` and `unresolved_questions` are both evidence that instruction-level protection fails. There is nothing to leak if it was never in the context.

### 2.3 Naming — needs an explicit call

`internal_only` on flags currently means inform the direction but don't restate it to the couple. A marked source means this content is removed from the direction entirely, planner-facing output included. Same word, materially different effect. Recommendation: give the source-level field a distinct name (`exclude_from_direction`, or similar) and leave the flag-level `internal_only` semantics untouched. Report the current flag field name and type before naming the new one.

**Retained:** the flag-level toggle stays, but only for sensitivity that emerges from juxtaposition — where neither source is sensitive alone.

## 3. Known limitation to write into the UI, not paper over

A planner can restate sensitive content in a free-text resolution on an unrelated flag. No mechanism catches that; the content has no traceable link back to a marked source. This is a copy problem, not a code problem, and it should be acknowledged in the marking UI rather than left implicit.

Second, the trade-off itself must be visible at the point of marking: marking a source removes it from the direction entirely, not just from the couple's view. The planner is choosing to lose that material from their own document too. If the copy doesn't say so, planners will mark liberally and wonder why the direction thinned out.

## 4. Check the repo first — report before writing any code

Answer all of these in a written report. Do not write a migration, a view, or a line of TypeScript until the report is reviewed.

1. **Schema.** Actual DDL for `source_items`, `extracted_items`, `flags`. Specifically: is the extracted-item → source link an array column, a join table, or a single FK? Quote it.
2. **Regeneration behaviour.** Do `extracted_items` also get new IDs on re-extraction, or are they stable? This determines whether derivation must key off `source_items` alone or can lean on extracted-item identity anywhere.
3. **Existing flag field.** Name, type, default of the flag-level `internal_only` column. Every read site — edge functions and client.
4. **Prompt assembly.** How `approve-direction` builds its prompt: which queries, what gets included, in what order. Quote the assembly block. Identify every path by which extracted-item content reaches the model.
5. **Migration divergence.** Contents of `supabase/migrations/` against what is actually applied. Twelve migrations exist with no repo file — confirm none of them already added a sensitivity-adjacent column under a different name.
6. **Client surfaces.** Which components render sources, extracted items, and flags, and where a marking control and an exclusion indicator would need to live.
7. **The hold.** Where the DB flag and the server-side check for `3579e5a0` live, so release is a deliberate step later and not an accidental side effect of this work.
8. **Backfill targets.** The two currently-marked flags: IDs, evidence item IDs, and the `source_items` they trace back to. Report only — change nothing. Note the blast radius: marking those sources will exclude everything else derived from them, which is likely more than the flag itself.

## 5. Build phases, with review stops

Stop for review at the end of each. Do not run phases together.

- **A — Report.** Section 4 only.
- **B — Schema + derivation.** Migration (as a repo file in `supabase/migrations/`, committed) adding the source-level field. The derivation view or shared helper. No consumers yet. Verify by query: mark a source in a scratch project, confirm the correct extracted items and flags read as sensitive.
- **C — Exclusion in `approve-direction`.** Filter at prompt assembly. Verify by diffing the assembled prompt with and without a marked source — the excluded text should be absent from the payload, not just absent from the output.
- **D — UI.** Marking control on sources, exclusion indicator on derived items, and the trade-off copy from Section 3. Copy comes to review before it ships.
- **E — Backfill.** Mark the two sources identified in A.8, with a report of everything each one now excludes.

Hold release on `3579e5a0` is not part of this build. It happens after B–E, as a separate deliberate step, once a generated direction has been diffed and confirmed clean.

## 6. Validation harness

Use the text-only Arden & Theo set (~86s), not the full set. Two reasons: the full set puts Phase 2 at 151.23s against a 150s ceiling, and the text-only set is already the committed gate for any model change on `flag-facts`. Same run does both jobs.

The propagation test that matters: mark a source, re-run extraction so flags regenerate with new IDs, confirm the derived sensitivity is still correct. That is the whole point of the build and the only test that proves it.

## 7. Explicitly out of scope

Do not touch, do not "fix while I'm here", do not include in the report:

- Phase 2 timing, batch capacities, or any batching redesign
- Reverting the `claude-sonnet-5` swap and `withOverloadRetry` on `approve-direction` / `generate-document-content` (separate job, do not bundle)
- Any model swap on `flag-facts` — the gate stands
- Deploy workflow, PDF export, image selection reaching Extract, couple-facing Update cycle
- Supplier Brief page-by-page review
- Backfilling the twelve orphan migrations
- Deleting the three `claude/*` branches
- Changing flag-level `internal_only` behaviour beyond leaving it intact
- Phase 2 component extraction

## 8. Kickoff prompt — paste this

> You are picking up work on the Wedding Brief Studio engine. Read `source-level-sensitivity-build-brief.md` in full before doing anything.
>
> Your first task is Section 4 only: investigate the repo and the database and produce a written report answering all eight questions. Quote actual DDL and actual code — do not summarise or paraphrase schema. Where you can't determine something from the repo, say so explicitly rather than inferring.
>
> Do not write a migration. Do not write a view. Do not write TypeScript. Do not modify any data, including the two flags in question 8. Do not touch anything in Section 7.
>
> When the report is complete, stop and wait for review. If anything in the brief conflicts with what you find in the repo, raise the conflict in the report rather than resolving it yourself.
