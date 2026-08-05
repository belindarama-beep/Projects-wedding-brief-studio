# Extract Timeout — Diagnosis and Three Paths

**Status:** diagnosis complete, nothing built. This is a decision document, not a build brief for a single approach — the three paths below are genuinely different in cost and in what they do to the pipeline's shape.

---

## Diagnosis, confirmed against real data

`extract-facts` is intermittently hitting Supabase's Edge Function wall-clock limit (HTTP 546) on the Arden & Theo project.

**Isolation test performed:** a scratch project was seeded with 50 synthetic text-only notes (4,757 characters — more items and more text than Arden & Theo's real 35-note baseline) and zero images, then `extract-facts` was invoked against it directly.

| Run | Composition | Result | Time |
|---|---|---|---|
| Isolation test | 50 text notes, 0 images | 200 | **86.2s** |
| Real project (first attempt) | 35 notes + 5 images | 546 (timeout) | 150.1s |
| Real project (retry, same input) | 35 notes + 5 images | 200 | 143.2s |

50 text-only items — more volume than the real baseline — finished in under a minute, comfortably clear of the ceiling. Adding just 5 images (all small, under 550KB) to a *smaller* text set added roughly 60 seconds and pushed both runs to the edge of the 150s wall. **This is images specifically, not total source count or total text volume.** Text scales cheaply here; each image is adding a large, disproportionate cost — almost certainly vision tokenization plus reasoning on `claude-opus-5`, not file size.

**Follow-up: the per-image cost curve, measured directly rather than projected from one point.** The same fixed 50-note text baseline was held constant while images (reused from Arden & Theo's real folder, referenced from a scratch project — not duplicated or touched) were added incrementally: 0, then 1, then 3, then 5.

| Images | Result | Time | Marginal cost (per newly added image) |
|---|---|---|---|
| 0 | 200 | 86.2s | — |
| 1 | 200 | 91.6s | +5.4s |
| 3 | 200 | 137.4s | +22.9s/image (2 images added) |
| 5 | **546 (timeout)** | ≥150.2s (censored — killed at the ceiling) | ≥12.8s/image, likely understated |

**This is not linear, and that matters for which path is right.** The first image cost almost nothing (+5.4s). Each image added after that cost substantially more than the one before it — the marginal cost roughly quadrupled between the 0→1 step and the 1→3 step. This is the signature of cost scaling with total context length rather than a flat per-image fee, consistent with how transformer attention cost grows superlinearly with sequence length: an image added to an already-large context (more prior text and images) costs more than the same image would added to a short one. Four data points (one of them censored by the timeout) isn't enough to fit a precise curve or extrapolate a specific "N images blows the 400s ceiling" number responsibly — but the trend itself is enough to change which path below actually addresses the problem, not just tolerates it.

**Timeout ceiling, confirmed via Supabase's docs (not assumed):** this is a hard platform limit, not a configurable default.
- Free plan (current): **150s** wall clock.
- Paid plans (Pro and above): **400s** wall clock.
- Not adjustable without changing plan tier, short of self-hosting Edge Functions entirely.

## Path 1 — Raise the ceiling (upgrade to a paid Supabase plan)

**What it is:** a billing change, not a code change. Moves the wall-clock limit from 150s to 400s.

**Cost:** real money — Supabase Pro is a $25/month base subscription fee for the organization (plus normal compute, which a project this size mostly covers with the plan's included credit). This is a decision for you, not something I can or should action — no plan-upgrade capability is something I have access to, and it shouldn't be a unilateral call regardless.

**What it buys:** less than it first appeared to. The measured curve (see above) shows accelerating, not linear, cost growth per image — so "2.7x more time" does not mean "2.7x more images." With only four data points (one censored by the timeout itself) there isn't enough to responsibly extrapolate a specific number of images the 400s ceiling would hold, but the shape of the curve means this buys less durable runway than a simple linear projection would suggest.

**Explicitly a stopgap, not a fix — more so than it first looked.** It doesn't change what's expensive, it just tolerates more of it, and the curve suggests that tolerance gets consumed faster than expected as the folder grows. Doesn't preclude either path below — could be done today, immediately, independent of whatever gets built next.

## Path 2 — Model swap, scoped as an experiment with a pass condition

**What it is:** swap `extract-facts`'s model (currently `claude-opus-5`) for something faster, to cut baseline latency across the board — including per-image cost, which is what's actually driving the timeout.

**Why this can't just be a config change:** `extract-facts` is the only model call in the entire system, and its output — classified facts plus contradiction/gap flags with quoted evidence — *is* the product. The five contradictions found on the real Arden & Theo material, each grounded in quoted evidence and found without an answer key, are the central proof that this pipeline actually works. Swapping the model risks that proof for a latency win that doesn't matter if the output gets worse.

**Pass condition — must be run and satisfied before this is adopted, not just informative:**
Run the candidate model against Arden & Theo's real, current text-only source set (no images, to isolate quality from the latency question). Compare its output to what `claude-opus-5` actually finds today: same set of contradictions and gaps, same or better evidence quality (evidence must still be a real quote/close paraphrase from the source material, not a vaguer restatement). If the candidate model misses a contradiction Opus finds, invents one, or degrades evidence quality — **the answer is no, regardless of how much faster it is.** Latency is the tiebreaker, never the deciding factor.

**Does not change pipeline shape.** Same single call, same architecture — only the model (and possibly `output_config.effort`) changes.

## Path 3 — Batching, the one that actually addresses the diagnosis

**What it is:** split source material into smaller batches so no single call processes too many images at once — the thing the isolation test shows is actually expensive, and the follow-up curve measurement shows is *accelerating*, not flat, as more images join the same context. That accelerating shape is what makes this path more than "the eventually-correct architecture" — if cost compounds with context length, small batches don't just avoid timeouts, they avoid paying the compounding penalty at all. Path 1 tolerates a bigger version of a cost that keeps growing; this path is the one that stops it from growing that way.

**Why this is the one that can break the product if done carelessly:** the spec has Extract deliberately re-read the *entire* folder in one call. A contradiction can only be found between two items that are present in the same reasoning pass — Arden's floral preference and Theo's, or the couple's stated wish against a family member's note, only surface as a contradiction if the model sees both at once. Naive batching (split the folder, run today's combined Extract+Organize+Flag call on each chunk independently) silently loses any contradiction whose two sides land in different batches. That failure mode is invisible — no error, just contradictions that quietly stop being found. This is exactly the kind of regression that matters most to catch, because it wouldn't be caught by watching for errors.

**The shape that preserves contradiction detection:** split the currently-bundled call into two phases.
1. **Per-batch fact extraction** — each batch (a manageable number of images plus its share of text) produces only classified facts (`extracted_items`), no contradiction/gap detection yet. This is what's expensive per-image, and batching keeps each individual call well under the wall-clock limit.
2. **A second pass over the combined fact set** — once every batch's facts are assembled, one further call runs *only* contradiction/gap detection (today's Flag responsibility) across the *complete, combined* set of extracted facts from all batches. This call is text-only (facts, not images) and comparatively cheap, however large the source folder gets — so this is also the piece that keeps working as the folder grows past whatever image count would otherwise force Path 1/Path 2 to be revisited again.

**This is an architectural change to the core Extract stage, not a performance tweak.** It requires two edge functions (or one function with two internal phases) where there is currently one, changes what `extractions`/`extracted_items` represent mid-flight, and needs its own validation pass — confirming on Arden & Theo's real material that every contradiction found today is still found after batching, before this replaces the current single-pass approach anywhere.

## Not yet decided

Which path (or combination) to build. Path 1 is unusual in that it's cheap enough to just do immediately as a buffer regardless of what happens with 2 or 3 — worth deciding on its own. Paths 2 and 3 are not mutually exclusive with each other either, but 3 is real design and build work where 1 and 2 are comparatively small. No code changes have been made against any of these — this document is the decision point.
