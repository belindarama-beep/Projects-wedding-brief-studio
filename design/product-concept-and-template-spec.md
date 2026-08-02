# The Australian Wedding Brief Studio — Concept, Scope & Template Spec

## What it is

A tool for independent Australian wedding planners that turns scattered, often contradictory client input — notes, images, voice recordings, consultation notes — into an approved, trustworthy creative direction, and then translates that one direction into the different documents a planner actually needs to send: to the couple, and to suppliers.

The core belief underneath it: the couple's real desire isn't a beautiful document, it's the feeling of being *understood*. The beautiful document is what proves that understanding happened. The planner is who delivers that feeling and gets the professional credit for it — the product exists to let them do that with a fraction of the design and interpretation effort it currently takes.

## Who it's for

Independent Australian wedding planners and coordinators — capable operationally, already using Canva or client presentations, but losing real time interpreting vague client preferences and rebuilding polished materials for every couple from scratch. Not aimed at large, design-led luxury studios who see creative interpretation as their own proprietary skill.

## The core functionality (the loop)

1. Each wedding gets its own project, with a **living source folder** — the planner can drop in pasted notes, transcribed voice notes, written consultation notes, and inspiration images, at any point, not just at intake.
2. When the planner asks the system to generate or update the direction, it re-reads the *entire* current folder (not just what's newly added) and:
   - extracts the facts, preferences, and constraints;
   - surfaces contradictions and gaps rather than smoothing them over (e.g. "relaxed" sitting against "very luxurious," or a stated moderate budget sitting against abundant floral references);
   - classifies what it's found (atmosphere, formality, colour/material, floral approach, guest experience, exclusions).
3. The planner — never the AI — resolves anything flagged as a genuine judgment call.
4. This produces an **approved creative direction**: a central idea, visual direction, colour/material direction, priority moments, what to avoid, and any open questions or budget implications.
5. Every time the direction is updated later, the system shows a plain-language summary of what actually changed, and keeps the previous version on record rather than overwriting it.
6. If a change is a genuine shift in direction (not just an addition), the couple can be shown a simple update and asked whether it still reflects them — light, trackable, no account required on their side.
7. From any approved direction, the system generates the actual client- and supplier-facing documents.

## Current scope (v1)

- **One vertical only:** Australian weddings. The underlying method is designed to extend to other markets later (brand briefs, interior projects, event briefs), but nothing beyond weddings is being built now.
- **A small, fixed set of 3–4 style/palette presets** — not an open-ended design system. Each document type has one structural layout, skinned by whichever preset the resolved style points to.
- **One supplier category to start: floral and styling.** Other supplier types (venue, photography, stationery, etc.) are not in scope yet.
- **No payments, no CRM, no run sheets/timelines, no automated vendor emails, no subscription or course.** These were all deliberately set aside to keep the build (and the product's identity) focused on the interpretation problem, not the operations layer already served by existing platforms.
- **No live Pinterest scraping** — inspiration comes in as uploaded images.

## Documents that need templates

| # | Document | Concept | Content | Format | File type |
|---|----------|---------|---------|--------|-----------|
| 1 | **Client-facing Creative Direction document** | The hero deliverable — what makes the couple feel understood. This is the one document worth the most design investment, since every project produces one and it's the primary trust-building artifact. | Central creative idea; visual direction narrative; colour & material direction; priority moments; what to avoid; a budget-tier comparison (essential / elevated / signature) as a section within this document, not a separate file; supporting inspiration imagery woven in rather than listed. Written and laid out as something a couple would enjoy reading, not an internal working document. | Multi-page, editorial, image-integrated layout; reads like a considered lookbook, not a form output. Skinned by whichever of the 3–4 style presets the direction resolved to. | PDF (the artefact the planner sends/downloads); rendered first as an on-screen HTML view inside the app before export. |
| 2 | **Floral & Styling Supplier Brief** | The functional counterpart to #1 — same underlying approved direction, translated for a supplier who needs clarity and correct scope, not an emotional narrative. | The decisions relevant to floral/styling specifically: colour/material direction, quantities and must-haves, the sensible swap at a lower budget tier, what to avoid, plus the practical context a florist/stylist needs (venue, guest count, date). | Clear, sectioned, utilitarian layout — still branded to the planner and consistent with the chosen style preset, but prioritising scannability over editorial flourish. | PDF |
| 3 | **Early Direction Snapshot** (pre-signing) | Not a separate template — this is the *same* Creative Direction template (#1), generated early from thinner information and explicitly framed as a working first impression rather than a finished brief. Exists to give planners something to show a prospective couple without duplicating design effort on a bespoke "pitch deck." | Whatever's confirmed so far, with open questions clearly marked as still-to-be-resolved rather than papered over. | Same layout and presets as #1, just populated with less. | PDF (or viewed on-screen only, without exporting, if it's only ever shown live) |
| 4 | **Couple-facing Direction Update view** | Not a printed document — a lightweight, branded screen shown via a shareable, no-login link when a real directional change has happened, with a simple "still us" / "let's talk" response. | A plain-language summary of what changed since the couple last saw the direction — not the full document repeated. | A single web page, calm and on-brand, not a dashboard. Needs its own light design treatment consistent with the presets, but it's a screen, not a print layout. | HTML (in-app page), not a downloadable file — though logging/exporting it later for record-keeping is a reasonable future addition, not needed now. |

## Cross-cutting design note

Everything above is built as **one structural layout per document type**, skinned by the 3–4 style presets (a shared palette + font pairing + accent motif) rather than fully bespoke designs per preset. So the real design task is: design documents #1 and #2 once each, properly, then create the 3–4 skins that can be swapped onto either — not 8–12 separate document designs.
