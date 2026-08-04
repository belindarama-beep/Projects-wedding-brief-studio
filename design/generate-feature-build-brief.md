# Generate Feature — Build Brief

**Stage:** Generate (stage 7 of the eight-stage core engine).
**Goal of this phase:** render an Approved Record into the actual client-facing Creative Direction document for Arden & Theo — on-screen first, PDF second. This is the last piece of the originally-scoped Phase 1: one complete wedding journey, one real Output.

---

## Objective

Take the `direction_versions` row Approve now produces for Arden & Theo, and render it into the nine-page Creative Direction document — cover, what we understood, visual direction ×3, direction spelled out, budget tiers, open questions, sign-off — skinned by whichever style preset the project uses, with real approved content (not placeholder demo text) filling every section without the layout breaking.

**Token source of truth has changed since this brief was first drafted.** The design system now has four approved presets — Terracotta & Architecture, Ancient Rose, Fig, Lilac & Sage — replacing the earlier three-preset version (Nocturnal + Botanical and Dusty Teal were both cut for lacking a genuine dark anchor). `wedding-brief-studio-brand-guidelines-v2.html` is the current reference; it needs to actually be added to the repo (a `design/` or `docs/` folder is fine) before Claude Code can read it — it only exists as a chat artifact right now.

## In scope

- **Content mapping**: map `direction_versions.content` (central idea, visual direction narrative, colour/material direction, priority moments, what to avoid, budget tiers, still-open questions) onto the nine confirmed pages
- **Flow layout conversion**: wherever the existing templates still use fixed pixel positioning, convert to flexbox/grid so variable-length real content (a longer headline, a longer narrative paragraph) doesn't break the page. This is a precondition for the rest of this phase to mean anything, not a separate cleanup task — confirm current state before assuming how much of this remains
- **Preset application**: apply whichever of the four style presets the project is set to (planner-controlled, project-level — confirm how/where that's currently stored), using the token values in `wedding-brief-studio-brand-guidelines-v2.html`
- **Composition rules for the visual direction pages** — these came out of a live design exploration and aren't optional polish, they're what the flow-layout conversion needs to actually satisfy:
  - Image slots must absorb anywhere from 1 to ~5 uploaded images without the layout breaking or needing a different template
  - The document now has seven visual devices across three registers (weighted / gestural / functional) — see `wedding-brief-studio-composition-devices.html` for the full decision table. **A document must draw from at least two registers across its nine pages.** Repeating one device identically on consecutive pages is the specific failure this system was built to prevent, and it's exactly what happened in the first real Arden & Theo render — don't repeat it
  - All weighted-register devices stay contained to a defined zone — never a full-bleed dark background. This is both a print-cost concern and the actual mechanism that gives a page presence
- **Inspiration imagery**: weave uploaded source images into the visual direction pages. For this phase, planner-selected is enough — the planner marks which uploaded images belong in the document, rather than the system choosing automatically. Automatic selection is a reasonable future refinement, not required now
- **Planner mark slot**: logo image if supplied, gracefully falling back to a styled text wordmark if not — per the brand guidelines, documents go out under the planner's own business name, never "Wedding Brief Studio"
- **On-screen render first**: the document renders as an HTML view inside the app before any export exists
- **PDF export**: once the on-screen render is correct, export to PDF

## Out of scope for this phase

- **Supplier Brief** (document type two) — separate layout, separate phase
- **Early Direction Snapshot** — reuses this same template once it works, but the explicit "early/thinner, open questions marked" framing is its own small follow-up, not this phase
- **Automatic image selection** — planner-selected is sufficient for now
- **The couple-facing Update view's diff/response handling** — already out of scope from the Resolve/Approve phase, still out of scope here
- **All four presets being visually verified** — get one preset (Terracotta & Architecture, since it's the one already tested against thin/rich content) fully correct against real content first; confirming the other three is a fast follow-up once one works, not a reason to quadruple the scope now

## Before writing any code — check the repo first

1. **Current state of the nine-page templates** — are they built and working only against the static Isla & Matteo demo data, or do they already accept dynamic content in any form?
2. **Fixed-positioning-to-flow-layout conversion** — how much of this is already done versus still outstanding? Don't assume the full conversion is needed; confirm what's actually left.
3. **Is there an `outputs` (or similarly-named) table already**, or does this phase need to create one to record what was generated, from which Approved Record, in what format?
4. **How image placement currently works in the templates** — hardcoded to specific demo images, or is there already a mechanism for choosing which uploaded images go where?
5. **Current PDF export mechanism, if any** — is Playwright/headless Chrome already wired up for this, or does it need to be built from scratch?
6. **Where/how the project's chosen style preset is currently stored**, so Generate knows which skin to apply for Arden & Theo — and whether it's still pointing at one of the two cut presets, which would need migrating to one of the four current ones.

## Success criteria

For the Arden & Theo project, after a direction is approved, the planner can generate and view the full nine-page Creative Direction document on-screen — correctly skinned, real approved content in every section, no broken layout on the actual (not placeholder) headline and narrative lengths — and export it to a PDF that matches the on-screen version.

---

## Kickoff prompt (ready to paste into Claude Code)

```
I'm building Generate for Wedding Brief Studio — rendering an approved
direction_versions record into the real nine-page Creative Direction document.
Read the following files in the design/ folder of this repo before writing
anything:

- generate-feature-build-brief.md — this brief, full scope
- wedding-brief-studio-brand-guidelines-v2.html — current token source of truth
  (four presets: Terracotta & Architecture, Ancient Rose, Fig, Lilac & Sage)
- wedding-brief-studio-composition-devices.html — the device decision table:
  seven visual devices across three registers (weighted / gestural /
  functional), each with a specific job. A real document must draw from at
  least two registers across its nine pages — repeating one device
  identically (as the first Arden & Theo render did with the arch stack) is
  the exact failure mode this file exists to prevent. Read the legend at the
  top before touching the visual direction pages.
- visual-direction-palette-test.html — working reference implementation of the
  composition rules (image slots absorbing 1-5 photos, the layered arch-stack
  depth device, print-conscious containment) — read the actual CSS here, don't
  infer the rules from prose alone
- product-concept-and-template-spec.md — the content spec for what goes on each
  of the nine pages
- wedding-brief-studio-core-engine-spec.md — the Approved Record field shape
  (central idea, visual direction, colour/material direction, priority moments,
  what to avoid, budget tiers) that direction_versions.content needs to map from

If any of these aren't in design/ yet, ask me before proceeding rather than
guessing at their content from memory.

Before writing any code, check the current repo state and tell me:
1. Whether the nine-page templates currently work only against static Isla &
   Matteo demo data, or already accept dynamic content in any form.
2. How much of the fixed-positioning-to-flow-layout conversion is already done
   versus still outstanding.
3. Whether an outputs table (or similarly named) already exists.
4. How image placement currently works in the templates — hardcoded to demo
   images, or is there already a selection mechanism.
5. What PDF export mechanism, if any, already exists — Playwright/headless
   Chrome or otherwise.
6. Where the project's chosen style preset is currently stored, and whether it's
   still pointing at one of the two cut presets (Nocturnal + Botanical, Dusty Teal).

Report back on those before building anything — #1 and #2 especially change how
much of this phase is new work versus wiring real data into what's there.

Then build: take the latest approved direction_versions row for the Arden & Theo
project and render it into the nine confirmed pages (cover, what we understood,
visual direction x3, direction spelled out, budget tiers, open questions,
sign-off), applying the project's chosen style preset (Terracotta & Architecture
first). Convert any remaining fixed-position layout to flow layout so real,
variable-length content doesn't break the page — the visual direction pages
specifically need to absorb 1 to ~5 uploaded images without breaking, and depth
should come from a layered, shadowed arch stack contained to a defined zone,
never a full-bleed dark background. Let the planner select which uploaded source
images appear in the visual direction pages. Include the planner mark slot (logo
if supplied, styled text wordmark if not). Render this as an on-screen HTML view
first; once that's visibly correct against real approved content, add PDF export.

No Supplier Brief, no automatic image selection, no couple-facing diff/response
handling, and don't worry about verifying all four presets — get Terracotta &
Architecture fully correct against real Arden & Theo content first.

Stop once the Arden & Theo document renders correctly on-screen with real
content and exports to a matching PDF, before doing anything further.
```
