# Document Generation Content Issues — v9 Review Findings

**Status:** three findings from reviewing the generated v9 document, all now decided. Build order is set — see bottom of this document.

---

## `budget_implications` — (a) a straightforward prompt bug, ready to build

No couple-facing field should ever literally reference `planner_notes` or point the reader to "the planner" as somewhere to find more information — regardless of whether the underlying topic is otherwise fine to mention. Confirmed in v9: `budget_implications` ends with *"Funding governance for the flowers should be settled before spend is committed (see planner notes)."* `planner_notes` is a field the couple can never see; telling them to consult it is broken on its own terms, independent of whether the funding topic itself should have been visible at all (that's the separate `internal_only` persistence issue, see `flag-resolution-carry-forward-build-brief.md`).

**Scope:** add an explicit instruction to `approve-direction`'s system prompt — no couple-facing field (`central_idea`, `visual_direction`, `colour_material_direction`, `priority_moments`, `what_to_avoid`, `fixed_decisions`, `flexible_decisions`, `budget_implications`) may reference `planner_notes`, "the planner," or any other internal-only field as something the reader should consult. This is independent of the internal_only enforcement problem and doesn't need to wait for it — a prompt-level fix, not a data-model one.

Worth flagging, not scoping: this relies on the model following the instruction, the same way the current internal_only field list already relies on instruction-following and turned out to be incomplete. No structural backstop is proposed here — noted so it isn't silently assumed to be airtight.

## `budget_implications` — (b) a design question, not a bug — decision owed

The field's own instruction in `approve-direction`'s system prompt is: *"a short synthesis of what the extracted material and resolved decisions **imply** for budget."* "Imply" is explicit permission to infer beyond what any single Extracted Item or Resolution actually states, with no traceability requirement — unlike `contradictions`/`unresolved_questions`, which must cite a real `flag_id`. Confirmed in v9: *"reduced service aisles... may affect catering service labour"* and *"two-colour stationery... is a modest print cost"* are the model connecting dots across several facts, not restating anything a source or resolution said.

**The options, with what each costs:**

1. **Leave it as-is.** Keeps the field genuinely useful — this kind of synthesis is plausibly exactly what a planner wants from an AI-assisted budget summary. Cost: inference is presented with the same confidence and formatting as confirmed fact, in a document a couple reads as authoritative. Nothing distinguishes "the extraction said this" from "the model worked this out."
2. **Restrict to pure restatement** — only report literal costed figures and resolved decisions, no inferred downstream effects. Cost: likely guts the field's practical value. Much of what currently makes it useful (flagging that long tables + reduced aisles could affect service, that a two-colour print run is cheap) is exactly the kind of connection a strict restatement rule would forbid. Could leave the field as little more than "confirmed figures: $16,000 floral, ~$3,500 stationery," which may not be what's actually wanted either.
3. **Middle ground — allow inference, but label it as inference.** Keep synthesis of stated/resolved facts as-is, but require anything beyond that to be visibly marked as a consideration rather than blended into flat prose — e.g. a distinguishable "worth noting" phrasing convention, or a separate structured sub-field. Preserves the field's usefulness while addressing the "presented as fact" concern directly. Cost: more prompt complexity, and still depends on the model correctly self-identifying which of its own statements are inference versus restatement — the same reliability question as everything else here, just with a lower cost if it's imperfectly applied (mislabeled inference is still visibly labeled *as* inference, not silently blended in).
4. **Move inference out of the couple-facing document entirely** — keep it available to the planner (e.g. in the Supplier Brief or a planner-only view) but not in the Creative Direction document the couple reads. Cost: removes information from the document that's arguably useful to the couple too, and doesn't fix the underlying "who is this claim actually for" ambiguity so much as relocate it.

**Decided: option 4, moved out of the couple-facing document — not deleted.** Option 3 (label inference distinctly) was rejected explicitly: it relies on the model correctly self-labelling which of its own statements are inference, the same trust problem this is meant to remove, and a couple reading "we've inferred this" in a document whose job is to prove they were understood is an odd artefact regardless of labelling accuracy.

The inference is genuinely useful — it just belongs where a planner can read it, act on it, or deliberately promote it into the document, not automatically blended into couple-facing prose. Concretely: `budget_implications` becomes strictly traceable to a source or a decision — confirmed figures, the stated pressure point, the tier comparison. A new field, `budget_considerations`, carries the inferred operational consequences (service labour, print cost, and similar), surfaced planner-side in `DirectionView.tsx`, never in the generated document. No "promote to document" mechanism is being built as part of this — noted as a possible follow-up if wanted, not assumed.

## Colour swatches — options, not a fix — decision owed

**Confirmed:** the Approved Record carries no structured colour values at all. `colour_material_direction` in `approve-direction`'s schema is a single free-text string — there's no colour array or hex list anywhere in `direction_versions.content`. `ColourRail.tsx` renders four hardcoded CSS variables sourced from `presets.ts` — one of four fixed named style presets (`terracotta-architecture`, `ancient-rose`, `fig`, `lilac-sage`) chosen by the planner separately at Generate time, with the swatch labels ("Primary depth," "Structural cool") also hardcoded and generic. The palette preset and the couple's actual colour direction are two unrelated systems that happen to render on the same page. "Deep bottle emerald, merlot, deep blush" (v9's actual prose) can never appear as a swatch under the current design, regardless of which preset is picked, because nothing reads the approved colour prose to produce them.

**Option A — extract structured colour values into the Approved Record.**
Add a real structured field to `approve-direction`'s output schema (e.g. named colours or hex values) and have `ColourRail.tsx` render those instead of preset tokens. Cost: genuine architecture work — needs a decision on what "structured" means (named colours vs. hex vs. a constrained enum), needs the model prompted to produce structured output that actually agrees with its own prose (avoiding trading one mismatch for another), needs new rendering logic, and needs a fallback for every existing approved version (v1–v9) that predates the field and won't have it.

**Option B — remove the swatch block entirely.**
Cost: near-zero — delete the `ColourRail` render call and adjust the surrounding layout. Loses a visual/decorative device from the document. Benefit: immediately stops the document from displaying something that can contradict its own prose. No new data model work, nothing to get wrong.

**Decided: Option B, remove the block.** Beyond cost, Option A has a real problem of its own: it would make the model responsible for translating prose like "a deep blush understood as a dark rose just before it turns red" into a hex value and presenting that as fact on a couple-facing page — a fairly consequential interpretive act nobody actually made, dressed up as a decision. Page 4's prose is already specific and vivid enough to carry the section on its own. If the page reads thin without the block, that's a composition problem to solve with the existing device framework, not a reason to keep a contradictory element.

## Images — third instance of the same pattern, noted only

A planner decision made at one stage doesn't persist back into the pipeline stage that would need to know about it — this is now a confirmed pattern, not a one-off:

1. **Resolutions** don't persist across Extract re-runs (`flag-resolution-carry-forward-build-brief.md`).
2. **`internal_only` markings** don't persist across Extract re-runs (same brief, interim fix).
3. **Image curation** — confirmed here: `documents.selected_image_ids` (the planner's deliberate choice of which images represent the visual direction, including excluding one for violating the no-suspended-installation rule) is stored only on the `documents` row, per-generation. It never reaches `extract-facts` or `approve-direction`. The open question on page 8 (*"What is the status of the five unattributed image references?"*) covers all five originally-uploaded images, including the one already excluded by curation — because the exclusion decision and the flag-generation pipeline have no way to know about each other.

Not designing a fix for this. Noted so the next time this pattern surfaces, it's recognized as the fourth instance of something systemic rather than investigated fresh again.

## Build order

1. `planner_notes` reference prompt fix (smallest, unambiguous).
2. `internal_only` interim UI + reminder list (`flag-resolution-carry-forward-build-brief.md`) — the live leak, highest real-world cost of delay.
3. The two decisions above — `budget_considerations` split, colour swatch removal.
4. Images — untouched, no fix designed yet.
