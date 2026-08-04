# Supplier Brief Feature — Build Brief

**Document:** #2, the Floral & Styling Supplier Brief — the functional counterpart to the Creative Direction document.
**Goal of this phase:** generate a scannable, utilitarian brief a florist/stylist can actually work from, using the same approved direction already produced for Arden & Theo — no new upstream engine work, but a genuinely new structural layout.

---

## Before anything else — a content audit, not a build task

This document needs specific content the Creative Direction document may not actually have, structured, yet:

- **Quantities and must-haves** — florist-specific detail (how many centrepieces, vessel counts, etc.)
- **The sensible swap at a lower budget tier** — a floral-specific fallback, distinct from the three-tier essential/elevated/signature structure

The Arden & Theo v6 Budget Tiers page states outright: *"Budget tiers for this version are still being prepared."* That means the tiered structure this spec assumes may not exist as real content in this — or any — approved version yet.

**This needs an answer before template design starts:**
1. Is budget-tier content a genuine gap in the Resolve/Approve stage — something that should be captured as structured data but currently isn't anywhere in the pipeline?
2. Or is it specific to Arden & Theo — a real, legitimate "not decided yet" for this one couple, with the underlying capability already there for a project where it has been decided?

If it's #1, this brief is bigger than it looks — it may need a Resolve/Approve change before a Supplier Brief can ever show real tier-swap content for any project. If it's #2, this document can be built now and will simply show "not yet decided" for Arden & Theo the same honest way the Creative Direction document already does, which is a fine, correct outcome — not a bug to fix.

**Don't guess — check the actual data**, not just this one document's rendered output, before scoping the rest of this brief.

## Objective

Once the audit above is resolved: generate the Supplier Brief from the same `direction_versions` Approved Record already used for the Creative Direction document, in a new, distinct, utilitarian layout — sectioned and scannable rather than editorial — skinned by the same token system (whichever of the four presets the project resolved to).

## In scope

- **A new structural layout** for this document type — not a reuse of the nine-page lookbook template. Per the original design spec: clear, sectioned, utilitarian, branded and on-preset, prioritising scannability over flourish
- **Content mapping**, scoped to what's actually confirmed available after the audit above:
  - Colour/material direction relevant to floral & styling specifically
  - Quantities and must-haves (if genuinely present in approved content)
  - The lower-tier floral swap (if genuinely present — see audit)
  - What to avoid — the floral/styling-relevant subset, not the couple-facing document's full list
  - Practical context up front and prominent: venue, guest count, date — a florist needs this immediately, not buried at the end the way the couple-facing sign-off page has it
- **Reuses the existing Approved Record** — no new AI call, no changes to Extract/Resolve/Approve unless the audit reveals a genuine structural gap (flag and stop if so, don't build around a workaround)
- **On-screen render first**, same pattern as Generate

## Out of scope for this phase

- **PDF export** — still deferred project-wide, not specific to this document
- **Any changes to Resolve/Approve** — unless the audit above genuinely requires it, in which case that's a separate, prior brief, not folded into this one
- **Supplier categories beyond floral & styling** — the only one in scope per the original spec; no need to build a category-selection UI
- **A planner-facing UI for choosing which document to generate**, if one doesn't already exist from Generate — a simple, direct trigger is enough for this phase

## Before writing any code — check the repo first

1. **Answer the audit question above** — is the tier-swap/quantities gap systemic or Arden & Theo-specific? This determines whether this brief is scoped correctly as written.
2. **How is `documents`/`outputs` currently structured** — does it already support more than one document/output type, or is everything from Generate hardcoded to the Creative Direction type? Adding a second type may be schema work, not just a new template.
3. **Is there an existing entry point** on the Arden & Theo project page for triggering a second document type, or does this need a new UI element from scratch?
4. **Confirm the current style preset storage** (`projects.style_preset`) is readable from wherever this new template renders — it should be, but confirm rather than assume.

## Success criteria

For the Arden & Theo project, a planner can generate the Supplier Brief from the same approved direction, on-screen, in a distinct utilitarian layout correctly skinned to Terracotta & Architecture — with practical context (venue, date, guest count) immediately visible, and every other section showing either real approved content or an honest "not yet decided," never fabricated detail.

---

## Kickoff prompt (ready to paste into Claude Code)

```
I'm building the Supplier Brief (document type 2) for Wedding Brief Studio —
generated from the same direction_versions Approved Record already used for
the Creative Direction document, in a new, utilitarian layout. Read
supplier-brief-feature-build-brief.md in the design/ folder of this repo for
full scope.

Before any template or design work, answer the audit question the brief opens
with: is the missing budget-tier-swap content (the Arden & Theo v6 Budget
Tiers page says "still being prepared") a systemic gap in Resolve/Approve, or
specific to this one project not having decided it yet? Check this by looking
at the actual approved content structure, not just this one rendered
document. Report back before proceeding — if it's systemic, stop and tell me
rather than building around a workaround.

Also check and report on:
1. Whether documents/outputs already supports more than one document type, or
   everything is currently hardcoded to Creative Direction.
2. Whether an entry point for triggering a second document type already
   exists on the project page.
3. That projects.style_preset is readable from wherever this renders.

Once those are answered, build: a new structural layout for the Supplier
Brief — sectioned, scannable, utilitarian, not a reuse of the nine-page
template — skinned with the same token system. Map colour/material direction,
quantities and must-haves, the lower-tier floral swap, and what-to-avoid
(floral-relevant subset only) from the approved content, with practical
context (venue, guest count, date) prominent near the top rather than at the
end. Render on-screen first.

No PDF export, no Resolve/Approve changes unless the audit found a genuine
gap, no supplier categories beyond floral & styling, no new document-type
picker UI beyond a simple trigger.

Stop after the Arden & Theo Supplier Brief renders correctly on-screen with
real approved content, before doing anything further.
```
