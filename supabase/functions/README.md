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

**What would actually close the gap:** a GitHub Actions workflow. This makes the repo the actual source of truth — a deploy can only happen as a consequence of a commit, not disconnected from one. **Scoped below, not built** — the token is a credentials decision to be made deliberately, not something to action unprompted.

### The workflow file

A `.github/workflows/deploy-edge-functions.yml` that, on trigger: checks out the repo, sets up the Supabase CLI (`supabase/setup-cli`), and runs `supabase functions deploy <name> --project-ref rmjhcflxxxmenlqzjlwr` once per function directory under `supabase/functions/` (looping over the three subdirectories explicitly, rather than relying on a possible "deploy everything" CLI mode — safer to be explicit about which three are expected than to trust directory discovery silently picking up something unintended later). Auth via `SUPABASE_ACCESS_TOKEN` read from a repo secret, per Supabase's own documented CI pattern.

### Token scope — the honest answer, not just the least-privilege answer

The ask was a token that can't do more than deploy functions. **Supabase's access token model doesn't offer that.** A Personal Access Token is account-scoped, not operation-scoped — it authenticates the CLI as whichever account generated it, with that account's full access to every project and org it belongs to, for every CLI command, not just `functions deploy`. There is no narrower token type to request instead; this isn't a configuration this workflow failed to find, it's a gap in what the platform exposes.

The closest available approximation: don't use the primary account's own PAT. Create a separate Supabase member (a bot/service account) whose project membership is limited to this one project only, generate the PAT from that account, and grant it the minimum role the CLI actually needs to deploy functions (needs confirming at build time — likely "Developer," not "Owner" or "Admin"). That token still isn't operation-scoped — anyone holding it could run any CLI command against this one project, not just deploys — but it can't reach any *other* project or org, which is the meaningful boundary actually available. This is the credentials decision — which account, what role, how the PAT is generated and stored — left for deliberate action, not decided here.

### Trigger: every push, or main only

Recommend **main only** (deploy on merge/push to the default branch), not every push to a feature branch. Reasoning: `approve-direction` is the single highest-stakes artifact in the product — an in-progress edit on a feature branch shouldn't go live the moment it's pushed, only once it's actually merged. Every-push deployment optimizes for fast feedback at the cost of exactly the kind of accidental half-finished-prompt-in-production this whole exercise is meant to prevent. This is a recommendation, not a decision made on your behalf.

### Partial failure — what a 3-function deploy can leave behind

Supabase has no atomic multi-function deploy primitive — each `supabase functions deploy <name>` call is independent. No CI design changes that; a workflow deploying three functions can always end with some updated and some not, regardless of how the steps are structured. Two real choices about how visible that state is:

- **Continue-on-error per step, fail the job if any step failed.** All three deploys are attempted regardless of an earlier failure (so a transient blip on function 1 doesn't block functions 2 and 3 from updating), but the overall workflow run shows red if anything failed, and the logs show exactly which succeeded. Recommended over fail-fast: fail-fast would leave functions *after* the failing one not even attempted, which is a worse partial state for no real benefit — these three functions don't depend on each other's deploy succeeding.
- Either way, redeploying the same content is a no-op in effect — re-running the workflow after fixing whatever failed is the recovery path, not something that needs hand-diagnosis of which function is on which version first (that diagnosis is exactly what the failed run's logs already show).

### Drift detection — does it catch a dashboard/MCP hotfix, or silently overwrite it?

**As scoped above: silently overwrites it. This is the real gap in the baseline plan, not an edge case.** A standard push-triggered `supabase functions deploy` workflow is one-directional, git-to-Supabase only. It has no step that checks what's currently live before overwriting it. If someone hotfixes `approve-direction` directly via the dashboard or an MCP tool under pressure — exactly how today's drift happened in the first place — the next merge to main that touches (or doesn't even need to touch) that function will silently replace the hotfix with whatever's in git, with no warning that anything was overwritten.

Closing this needs an explicit pre-deploy check, not something the baseline workflow gets for free: fetch the currently-deployed function's content (via the CLI or the same `get_edge_function` MCP call used to build this snapshot) and compare it against what git believes was last deployed — not against the new content about to be deployed, since those are expected to differ; the comparison has to be against a persisted record of "what git last put into production" for that function. That record doesn't exist yet either — it would mean committing something like a content hash alongside each function, updated only by the deploy workflow itself, so a mismatch between that hash and the live function's actual current hash means something changed production out-of-band since the last git-driven deploy. If found, the honest options are: fail the deploy and surface the diff for a human to reconcile, rather than either silently overwriting or silently skipping.

This is real, additional work beyond the baseline workflow — noting it as a known limitation of the baseline scope so it isn't assumed to already be covered, not deciding here whether it's worth building.
