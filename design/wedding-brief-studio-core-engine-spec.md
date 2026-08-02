# Core Engine Specification (v1 — internal)

**Status:** working reference, not yet implemented as a generalized layer
**Scope:** defines the vertical-agnostic engine that the wedding product is the first real implementation of. Internal vocabulary only — no customer, planner-facing screen, or document ever uses these terms directly. See the translation table below for what people actually see.

---

## 1. Why this document exists

The wedding product is being built as one complete, concrete journey — not as a generic platform with a wedding skin. This spec exists so that the *shape* of the engine is written down once, correctly, while it's still cheap to name things well — without that turning into an excuse to build abstraction ahead of need. Everything below should be readable as "this is what the wedding flow already does," not "this is a new system to build."

---

## 2. The workflow — eight stages

| # | Stage | Definition | What it looks like in the wedding product today |
|---|-------|------------|---------------------------------------------------|
| 1 | **Collect** | Raw material enters the system, unstructured, at any time — not just at intake. | Planner drops pasted notes, voice memos, consultation notes, inspiration images into a project's living source folder. |
| 2 | **Extract** | The full current body of material is read and broken into discrete, attributable pieces. | The system re-reads the *entire* folder (not just new items) and pulls out facts, preferences, and constraints. |
| 3 | **Organise** | Extracted pieces are classified into a fixed set of categories. | Atmosphere, formality, colour/material, floral approach, guest experience, exclusions. |
| 4 | **Flag** | Contradictions and gaps are surfaced explicitly rather than smoothed over. | "Relaxed" sitting against "very luxurious"; a stated moderate budget sitting against abundant floral references. |
| 5 | **Resolve** | A human — never the system — makes the judgement call on each flag. | The planner picks a resolution pill, writes a free-text resolution, or marks it "keep open." |
| 6 | **Approve** | A resolved state is committed and versioned; the prior state is kept, not overwritten. | The approved creative direction — central idea, visual direction, colour/material direction, priority moments, what to avoid. |
| 7 | **Generate** | Finished outputs are produced from one approved record. | Creative Direction document, Supplier Brief, Early Direction Snapshot. |
| 8 | **Update** | Later changes are diffed against the last approved record and, if material, put back in front of the customer. | Plain-language "what changed" summary; couple sees a lightweight update view and responds "still us" / "let's talk." |

The loop is not strictly linear in practice — Collect keeps happening throughout a project's life, and Update can trigger a fresh Extract → Organise → Flag → Resolve → Approve pass on just the changed material. The eight names describe *functions*, not a rigid sequence.

---

## 3. The object model

Neutral names, generic fields only. Anything specific to weddings hangs off these as an **extension**, never baked into the core shape.

| Object | Definition | Core fields (vertical-neutral) | Wedding-specific extension |
|---|---|---|---|
| **Project** | One engagement, one running body of source material and its history. | `id`, `name`, `created_at`, `status` | couple names, venue, date, guest count |
| **Source** | One piece of raw input, of any media type, timestamped and attributable. | `id`, `project_id`, `type` (text/audio/image/doc), `raw_content`, `added_at`, `attribution` (optional) | attribution tag (bride / groom / family / vendor) |
| **Extracted Item** | One discrete fact, preference, or constraint pulled from source material. | `id`, `project_id`, `source_ids[]`, `content`, `category_id` | — |
| **Category** | One classification bucket that extracted items get sorted into. | `id`, `name`, `order` | atmosphere / formality / colour-material / floral / guest experience / exclusions |
| **Flag** | A surfaced contradiction or gap between extracted items, or a stated absence of information. | `id`, `project_id`, `type` (contradiction/gap), `evidence_item_ids[]`, `state` (open/resolved/kept-open) | — |
| **Resolution** | The human judgement call that closes a flag. | `id`, `flag_id`, `method` (pill/free-text/kept-open), `content`, `resolved_by`, `resolved_at` | — |
| **Approved Record** | The versioned, committed state that outputs are generated from. | `id`, `project_id`, `version_number`, `content` (structured), `approved_at`, `superseded_by` | central idea / visual direction / colour direction / priority moments / what to avoid / budget tiers |
| **Output** | A generated artefact rendered from one Approved Record. | `id`, `approved_record_id`, `output_type`, `format` (html/pdf/web), `generated_at` | Creative Direction doc / Supplier Brief / Snapshot / Update view |
| **Version** | The record of what changed between two Approved Records, and whether it was material. | `id`, `project_id`, `from_record_id`, `to_record_id`, `diff_summary`, `is_material_change` | — |

---

## 4. Customer-facing translation table

Nobody outside engineering ever sees the left column.

| Internal | Planner/couple-facing |
|---|---|
| Project | The wedding / the couple's project |
| Source | A note, voice memo, image, or document in the folder |
| Extracted Item | A fact, preference, or constraint |
| Category | Atmosphere, formality, colour & material, floral approach, guest experience, exclusions |
| Flag | A contradiction or an open question |
| Resolution | The planner's decision |
| Approved Record | The approved creative direction ("Version 2.0") |
| Output | The Creative Direction document, Supplier Brief, Snapshot, or Update view |
| Version | "What changed since you last saw this" |

---

## 5. Fixed vs. pluggable

This is the line that keeps the naming honest. If something below the line ever needs to change to fit a new vertical, the naming in Section 3 wasn't actually neutral — revisit it then, not now.

**Fixed — true regardless of vertical:**
- The eight-stage loop itself
- The nine objects and their relationships
- A human always owns Resolve; the system never auto-resolves a Flag
- Approved Records are versioned and immutable once approved; nothing is silently overwritten
- Flags surface honestly rather than getting smoothed into safe, generic language
- Outputs are always generated *from* an Approved Record, never assembled ad hoc

**Pluggable — wedding-specific payload riding inside neutral containers:**
- The category taxonomy (atmosphere/formality/etc. is a wedding answer to "what are Categories," not the only possible one)
- The extraction logic/prompts that turn Source into Extracted Item
- The document templates that Generate produces (Creative Direction, Supplier Brief are wedding-specific Output types)
- The vocabulary in the translation table
- The palette/type system skinning the Output layouts

---

## 6. Build sequencing (confirmed)

**Phase 1 — one complete wedding journey.** Wire Collect → Extract → Organise → Flag → Resolve → Approve → Generate end-to-end for a single case (Arden & Theo, Yarra Valley) producing one Output: the Creative Direction document. No second document, no second vertical. The test: can someone see what went in, what the system noticed, what the planner decided, what came out, and why that beats prompting ChatGPT directly.

**Phase 2 — extract shared components, but only ones that have already proven themselves inside that flow:**
- source-material panel
- extracted-information card
- contradiction card
- missing-information card
- resolution control
- approved summary
- version label
- output selector
- document renderer

Each gets built once, inside the real flow, doing real work — not designed in advance as a generic component library.

**Phase 3 — not scheduled.** Generalizing the engine into a standalone, config-driven framework happens only once a second real vertical exists and shows where this model actually bends. Nothing in this document should be read as permission to start that work now.
