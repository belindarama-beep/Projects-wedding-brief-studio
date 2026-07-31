# Wedding Brief Studio

Next.js app for the Collect stage: a single-project "living source folder" view
for Arden & Theo, backed by Supabase Postgres + Storage.

## Setup

1. Copy your Supabase project's URL and anon/publishable key into `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
   ```

2. `npm install`
3. `npm run dev`, then sign in at [http://localhost:3000](http://localhost:3000) with an
   existing planner account (auth, schema, and RLS already exist on the Supabase
   project — this app doesn't provision any of that).

## What's here

- `/login` — email/password sign-in against Supabase Auth.
- `/project` — the Arden & Theo project view: paste a text note or upload an
  image, optionally tag it with Arden / Theo / Family / Vendor, see everything
  listed newest-first. Reuses the existing `source_items` table (adds an
  `attribution` column) rather than a new one, and the existing `source-files`
  storage bucket.
- `src/proxy.ts` — session-refresh + auth-gate, using Next.js's `proxy`
  convention (the successor to `middleware`, renamed in Next 16).
