# Edge functions — manual snapshot, not a build pipeline

These three directories are a verbatim copy of what's deployed on Supabase project `rmjhcflxxxmenlqzjlwr`, taken 2026-08-05:

| Function | Deployed version at snapshot time |
|---|---|
| `approve-direction` | 11 |
| `generate-document-content` | 4 |
| `extract-facts` | 6 |

They were transcribed directly from `mcp__Supabase__get_edge_function` / the exact content last deployed via `mcp__Supabase__deploy_edge_function`, with no cleanup, refactoring, or fixes applied during the copy — this is meant to be an accurate record of what's running, not a reviewed or improved version of it.

**This is a snapshot, not a synced source of truth.** Deploying via the Supabase MCP tools (or the dashboard) does not touch these files, and editing these files does not deploy anything — see "Deployment workflow" below for what closes that gap and what doesn't yet.

## Two things running in production that don't appear in any design brief

Both were reactive fixes for a live incident, made directly against the deployed functions, and are only recorded here.

**1. Temporary model swap, `claude-opus-5` → `claude-sonnet-5`, on `approve-direction` and `generate-document-content` only.**
Cause: a confirmed, live Anthropic incident — degraded performance on `claude-opus-5`, identified 2026-08-05 ~07:05 UTC, no ETA at the time. Both functions were timing out / returning sustained 500s on Approve and Generate. Swapping to `claude-sonnet-5` unblocked both.
**This needs reverting once the incident clears.** It is explicitly not the permanent model decision — that's a separate, already-scoped question in `extract-facts-timeout-brief.md` (Path 2), which requires a quality pass-condition before any permanent model change is adopted. This swap skipped that process on purpose, as a stopgap under active outage pressure. `extract-facts` itself was left on `claude-opus-5` throughout and was not touched.

**2. `withOverloadRetry` wrapper, same two functions.**
A single bounded retry (one retry, 5s delay) around the Anthropic call, only for `overloaded_error` (529) or other 5xx — anything else fails immediately, unchanged. Paired with `maxRetries: 0` on the Anthropic client so the SDK's own opaque default retry behaviour can't stack unpredictably on top of this one. Added for the same incident as above; not incident-specific in what it does (a bounded retry on transient overload is reasonable permanently), but was never written up as a deliberate design decision anywhere — this note is that record.

## Deployment workflow going forward

**What's not possible in this environment today:** the Supabase CLI (`supabase functions deploy`) isn't installed here, and this session has no direct network path to `*.supabase.co` — deploys can only happen through the `mcp__Supabase__deploy_edge_function` MCP tool, which takes inline file content as a parameter, not a git reference. There's also no CI configured in this repo (`.github/workflows` doesn't exist) that could run `supabase functions deploy` on push, which is the standard way to get "edit the file, commit, CI deploys" — that would need a Supabase access token stored as a GitHub Actions secret and a workflow file added, neither of which exists yet.

**What that means practically, until one of those is set up:** the discipline has to be manual — edit the file under `supabase/functions/<name>/index.ts` in this repo first, commit it, *then* deploy that same content via the MCP tool (or CLI/dashboard) as a separate, immediately-following step. That doesn't prevent drift on its own — nothing stops a future deploy from skipping the commit — but it at least makes "the repo is the draft, Supabase is what's live" the normal order of operations instead of the reverse, which is what produced today's gap.

**What would actually close the gap, if wanted:**
- Add a GitHub Actions workflow that runs `supabase functions deploy <name>` on push to this branch (or on merge to main), using a `SUPABASE_ACCESS_TOKEN` secret. This makes the repo the actual source of truth — a deploy can only happen as a consequence of a commit, not disconnected from one. This is the real fix; everything else is discipline, not a guarantee.
- Until that exists, treat this directory as requiring manual re-sync after every MCP/dashboard deploy — the same way this snapshot itself was produced.
