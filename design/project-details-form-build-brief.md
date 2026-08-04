# Project Details Form — Build Brief

**Goal of this phase:** give planners a real, direct way to set a project's baseline facts — venue, wedding date, guest count, budget — closing the gap that's now surfaced three separate times (wedding date, venue, guest count) across two different documents, each time requiring a direct database fix.

---

## Why this is its own brief, not bundled with anything else

Per the core engine spec, these fields are **Project-level setup metadata** — set once (and edited as things change), deliberately separate from the Approved Record's content. They're not something Extract, Resolve, or Approve should ever touch, infer, or version. This is plain CRUD, no AI involved — confirmed as the right scope in the investigation that led to this brief.

**One distinction matters more than anything else in this build**, and it came directly out of that investigation: the difference between a field that's *settled but never made it into the database* (venue, date, guest count — all now fixed for Arden & Theo, but the form is what prevents this happening for the next project) and a field that's *genuinely not yet decided* (budget — checked against the full approved content, no total exists anywhere, and none should be invented). The form needs to represent both states honestly: a real value where one exists, and a plain, honest "not yet decided" where one doesn't — never a placeholder standing in for either.

## Objective

A planner-facing section — on the project page, edited directly, no AI in the loop — for setting and updating: venue, wedding date, guest count, and total budget.

## In scope

- **A new "Project Details" section** on the project page (placement is a judgement call — likely near the top, since this is foundational information other sections implicitly depend on)
- **Four plain fields**: venue (text), wedding date (date), guest count (number), total budget (number) — directly editable, save writes straight to the corresponding `projects` columns
- **Honest empty states** — a field with no value shows as "not yet decided" or similar, not a blank input that looks broken or a zero that looks like a real answer
- **Editable at any time**, not just once at project creation — real weddings' guest counts and dates genuinely change over the course of planning
- **Total budget is a single overall figure**, distinct from the category-specific allocations that already live in the Approved Record's `budget_implications` (e.g. Arden & Theo's $16,000 floral/styling allocation and ~$3,500 stationery figure) — don't conflate the two or attempt to sum category figures into a total

## Out of scope for this phase

- **No AI-assisted extraction** of these values from source material — the exact behaviour that was just correctly removed (the `guestCountFromFixedDecisions` fallback); this form exists specifically so that workaround is never needed again
- **No versioning of these fields** — they're metadata, not Approved Record content, per the spec's fixed/pluggable split
- **No changes to Extract, Resolve, Approve, or Generate** — this is additive, not a pipeline change

## A genuine open question — worth your judgement, not a scoping default

If a planner edits guest count (or any of these fields) *after* a document has already been generated and approved against the old value, should anything flag that the existing document may now be stale? The fields themselves aren't versioned, but the documents that were generated while they held a different value still exist and could be handed to someone with outdated information. This wasn't resolved in the investigation that led to this brief — worth deciding deliberately rather than defaulting either way.

## Before writing any code — check the repo first

1. **Confirm exact current schema** — which of `venue`, `wedding_date`, `guest_count`, `budget` already exist as columns on `projects` (they should, since three were set directly already) and their types.
2. **Check whether the project's name/couple-names field has the same kind of gap**, or is reliably set at project creation already — worth a quick check rather than assuming it's fine just because it hasn't surfaced as a problem yet.
3. **Is there already a project header/details component** on the page that this should extend, or does it need to be a genuinely new section?
4. **Confirm which documents read these fields at render time** (both Creative Direction and Supplier Brief do) versus anywhere they might be cached or copied at generation time — relevant to the open question above.

## Success criteria

On the Arden & Theo project: venue, wedding date, and guest count display correctly in the new form (they're already correct in the database — this proves the read path matches what the documents already show). Budget shows an honest "not yet decided" state, since no real total exists for this project. Entering a test value for budget, saving, and confirming it now appears correctly in the Supplier Brief's practical-context header proves the write path works — with that test value clearly understood as a placeholder for verification, not a real confirmed figure for this couple.

---

## Kickoff prompt (ready to paste into Claude Code)

```
I'm building a Project Details form for Wedding Brief Studio — a plain,
planner-facing way to set venue, wedding date, guest count, and total budget
directly, no AI involved. Read project-details-form-build-brief.md in the
design/ folder of this repo for full scope.

Before writing any code, check and report on:
1. The exact current schema for venue, wedding_date, guest_count, and budget
   on the projects table.
2. Whether the project's name/couple-names field has any similar
   settled-but-unpopulated gap, or is reliably set already.
3. Whether a project header/details component already exists to extend, or
   this needs to be new.
4. Which documents (Creative Direction, Supplier Brief) read these fields at
   render time versus anywhere they might be cached separately.

Then build: a Project Details section on the project page with four plain,
directly-editable fields — venue, wedding date, guest count, total budget.
Saving writes straight to the projects table, no AI, no interaction with
Extract/Resolve/Approve. A field with no value should show an honest
"not yet decided" state, never a blank that looks broken or a zero that
looks like a real answer. Fields must be editable at any time, not just once.
Total budget is a single overall figure — don't derive or sum it from the
category-specific budget_implications already in the approved content.

Before finishing, give me your take on the open question in the brief: should
editing one of these fields after a document has already been generated
against the old value flag that document as potentially stale? Don't default
either way without flagging it.

Stop after the form works correctly on the Arden & Theo project — venue, date,
and guest count showing their real values, budget showing "not yet decided,"
and a test budget value correctly flowing through to the Supplier Brief once
saved — before doing anything further.
```
