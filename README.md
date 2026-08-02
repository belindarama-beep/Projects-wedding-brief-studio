# Wedding Brief Studio

Next.js app for the Arden & Theo project: a single-project pipeline covering
Collect, Extract, Resolve, and Approve, backed by Supabase Postgres, Storage,
and Edge Functions.

## Setup

1. Copy your Supabase project's URL and anon/publishable key into `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
   ```

2. `npm install`
3. `npm run dev`, then sign in at [http://localhost:3000](http://localhost:3000) with an
   existing planner account (auth, schema, RLS, and Edge Functions already
   exist on the Supabase project — this app doesn't provision any of that).

## What's here

- `/login` — email/password sign-in against Supabase Auth.
- `/project` — the Arden & Theo project view, covering four stages in order:
  - **Collect** — paste a text note or upload an image, optionally tag it
    with Arden / Theo / Family / Vendor, see everything listed newest-first.
    Reuses the existing `source_items` table (adds an `attribution` column)
    rather than a new one, and the existing `source-files` storage bucket.
  - **Extract** — runs the `extract-facts` Edge Function against the
    project's text/image source items (voice notes are out of scope). Reads
    back classified facts/preferences (`extracted_items`, grouped by
    category) and contradiction/gap `flags`. Never resolves anything itself
    — a flag may include 2-3 `suggested_resolutions` when it genuinely
    reduces to a small set of concrete options, but most flags get none.
  - **Resolve** — each flag from the latest extraction can be resolved
    inline: pick a suggested option, write free text, or explicitly keep it
    open. Persisted one row per flag in `resolutions` (method, content,
    resolved_by, resolved_at) via a direct RLS-scoped insert/upsert — no
    Edge Function involved.
  - **Approve** — runs the `approve-direction` Edge Function, which
    synthesizes the latest extraction's `extracted_items` plus whatever is
    in `resolutions` into a new `direction_versions` row. It never invents a
    new contradiction or gap — only what Extract already flagged and the
    planner already acted on (resolved or explicitly kept open) makes it
    into the approved content. Every approve writes a new version rather
    than overwriting the last one, together with a diff against the
    previous approved version.
  - **Direction** — shows the full content of the latest approved
    direction (central idea, visual direction, colour/material, priority
    moments, what to avoid, fixed/flexible decisions, budget implications,
    still-open contradictions/questions), a version switcher across every
    approved version, the diff from the previous version, and any private
    `planner_notes` in a clearly marked "do not share with the couple" block.
- `src/proxy.ts` — session-refresh + auth-gate, using Next.js's `proxy`
  convention (the successor to `middleware`, renamed in Next 16).

## Edge Functions

Both live on the Supabase project (not in this repo's source tree):

- `extract-facts` — Extract stage. Classifies source material into
  `extracted_items` and flags contradictions/gaps.
- `approve-direction` — Approve stage. Synthesis only; assembles
  `extracted_items` + `resolutions` into a new approved `direction_versions`
  row without re-interpreting or re-flagging anything.

The pre-existing `generate-direction` function (used by other projects on
the same Supabase project) is untouched by this app.
