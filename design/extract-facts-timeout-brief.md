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

**Follow-up: a per-image cost curve was measured (0/1/3/5 images against a fixed text baseline), showing an apparent acceleration in marginal cost per image. That specific curve-shape claim has since been retracted — see below.** The underlying `extracted_items`/`flags` rows from that test were deleted during cleanup before a necessary sanity check was run against them, so the claim can no longer be verified and shouldn't be relied on. What replaced it is a cleaner, real check below.

**Ruling out the obvious alternative explanation: is it images specifically, or just more output to generate?** More images could plausibly mean more extracted facts and flags, and output generation is sequential — that would produce a similarly-shaped slowdown without any actual per-image processing cost, and would mean batching helps far less than assumed (splitting calls doesn't reduce total output, it just spreads the same generation cost across more calls). This was checked directly against Arden & Theo's own real, untouched extraction history — a genuine before/after pair where the *only* change between two real runs was the 5 images being added, nothing else:

| Extraction | Sources | Extracted items | Flags | Total output (chars) | Time |
|---|---|---|---|---|---|
| Before images | 35 text | 41 | 23 | 17,837 | fast, no error (outside log retention) |
| After 5 images added, nothing else changed | 40 | 42 | 24 | 17,155 | **143.2s** |

Output was flat — one more extracted item, one more flag, total output character count *down* slightly — while execution time jumped from comfortably fast to the timeout ceiling. **This rules out output volume as the explanation.** Whatever is expensive here is in processing the images themselves, not in generating more content because of them.

**What remains genuinely unresolved:** whether that per-image cost is linear, accelerating, or something else. The evidence that suggested acceleration is gone (see above), and this before/after real-data check only proves *that* images are expensive independent of output size — not the shape of how cost grows with image count. That would need a properly re-run, output-count-preserved version of the earlier test, not attempted here.

**Timeout ceiling, confirmed via Supabase's docs (not assumed):** this is a hard platform limit, not a configurable default.
- Free plan (current): **150s** wall clock.
- Paid plans (Pro and above): **400s** wall clock.
- Not adjustable without changing plan tier, short of self-hosting Edge Functions entirely.

## Path 1 — Raise the ceiling (upgrade to a paid Supabase plan)

**What it is:** a billing change, not a code change. Moves the wall-clock limit from 150s to 400s.

**Cost:** real money — Supabase Pro is a $25/month base subscription fee for the organization (plus normal compute, which a project this size mostly covers with the plan's included credit). This is a decision for you, not something I can or should action — no plan-upgrade capability is something I have access to, and it shouldn't be a unilateral call regardless.

**What it buys:** genuinely unknown in precise terms. Images are confirmed expensive and confirmed not explained by output volume (see above), but exactly how cost grows with image count — linear, accelerating, or otherwise — is not established with reliable evidence. "Roughly 2.7x more headroom" from the 150s→400s ratio is a fair statement of the *time* ceiling moving, but not a safe translation into "2.7x more images," since that translation assumes linearity this brief can't currently back up either way.

**Explicitly a stopgap, not a fix.** It doesn't change what's expensive, it just tolerates more of it — true regardless of the growth curve's exact shape. Doesn't preclude either path below — could be done today, immediately, independent of whatever gets built next.

## Path 2 — Model swap, scoped as an experiment with a pass condition

**What it is:** swap `extract-facts`'s model (currently `claude-opus-5`) for something faster, to cut baseline latency across the board — including per-image cost, which is what's actually driving the timeout.

**Why this can't just be a config change:** `extract-facts` is the only model call in the entire system, and its output — classified facts plus contradiction/gap flags with quoted evidence — *is* the product. The five contradictions found on the real Arden & Theo material, each grounded in quoted evidence and found without an answer key, are the central proof that this pipeline actually works. Swapping the model risks that proof for a latency win that doesn't matter if the output gets worse.

**Pass condition — must be run and satisfied before this is adopted, not just informative:**
Run the candidate model against Arden & Theo's real, current text-only source set (no images, to isolate quality from the latency question). Compare its output to what `claude-opus-5` actually finds today: same set of contradictions and gaps, same or better evidence quality (evidence must still be a real quote/close paraphrase from the source material, not a vaguer restatement). If the candidate model misses a contradiction Opus finds, invents one, or degrades evidence quality — **the answer is no, regardless of how much faster it is.** Latency is the tiebreaker, never the deciding factor.

**Does not change pipeline shape.** Same single call, same architecture — only the model (and possibly `output_config.effort`) changes.

## Path 3 — Batching, the one that actually addresses the diagnosis

**What it is:** split source material into smaller batches so no single call processes too many images at once — the thing the evidence above shows is actually expensive (and confirmed *not* an artifact of generating more output). Whether batching's benefit is proportional (cost is linear in image count, so batching mainly buys wall-clock headroom per call) or more-than-proportional (cost compounds with context length, so small batches avoid a real penalty rather than just spreading it out) is not established either way — that finer question is explicitly open, not resolved in this brief. What is established is that this is the only path of the three that addresses the actual cost driver rather than tolerating it (Path 1) or leaving it untouched entirely (Path 2, which is about output quality, not this cost).

**Why this is the one that can break the product if done carelessly:** the spec has Extract deliberately re-read the *entire* folder in one call. A contradiction can only be found between two items that are present in the same reasoning pass — Arden's floral preference and Theo's, or the couple's stated wish against a family member's note, only surface as a contradiction if the model sees both at once. Naive batching (split the folder, run today's combined Extract+Organize+Flag call on each chunk independently) silently loses any contradiction whose two sides land in different batches. That failure mode is invisible — no error, just contradictions that quietly stop being found. This is exactly the kind of regression that matters most to catch, because it wouldn't be caught by watching for errors.

**The shape that preserves contradiction detection:** split the currently-bundled call into two phases.
1. **Per-batch fact extraction** — each batch (a manageable number of images plus its share of text) produces only classified facts (`extracted_items`), no contradiction/gap detection yet. This is what's expensive per-image, and batching keeps each individual call well under the wall-clock limit.
2. **A second pass over the combined fact set** — once every batch's facts are assembled, one further call runs *only* contradiction/gap detection (today's Flag responsibility) across the *complete, combined* set of extracted facts from all batches. This call is text-only (facts, not images) and comparatively cheap, however large the source folder gets — so this is also the piece that keeps working as the folder grows past whatever image count would otherwise force Path 1/Path 2 to be revisited again.

**This is an architectural change to the core Extract stage, not a performance tweak.** It requires two edge functions (or one function with two internal phases) where there is currently one, changes what `extractions`/`extracted_items` represent mid-flight, and needs its own validation pass — confirming on Arden & Theo's real material that every contradiction found today is still found after batching, before this replaces the current single-pass approach anywhere.

**Batch composition is a stated judgement, not something to leave for the implementation to discover.**

- **Batch by source type, not by flat count or by a cost model.** A flat item-count cap ignores the confirmed asymmetry (images are the expensive item; text is not) and would either still bundle multiple expensive images together or needlessly fragment cheap text. A true cost-weighted batcher is the theoretically cleaner answer, but isn't buildable with any real confidence right now — the actual per-image cost function is unmeasured (deliberately, per the decision above), so there's no calibrated cost to batch against. Batching by source type is the option that's both directionally correct on what's actually known and honestly implementable without data this brief doesn't have.
- **Text batches large, image batches small — starting point, not a derived optimum.** The isolation test showed 50 text-only notes completing comfortably in 86.2s; text batches can be generous (e.g. up to ~40 items, leaving margin) without revisiting this. Image batches should stay small (e.g. 2 per batch) given even 3 images already pushed close to the ceiling — but every image data point gathered so far included a large text baseline alongside it; a pure image-only batch's actual cost is itself unmeasured, so this starting number needs validating during build, not assumed correct.
- **Phase 1 batches don't need to mix source types.** Cross-referencing across the whole folder only has to happen in Phase 2, over the *combined* fact set — a Phase 1 batch's job is just to turn its own slice of source material into facts, independent of what else is in the folder. That's what makes clean type-separated batches viable at all.

**Batch membership must be deterministic and stable across runs — this is a hard requirement, not a nice-to-have.** The flag-resolution-carry-forward work (see `flag-resolution-carry-forward-build-brief.md`) matches new flags against previously-resolved ones by content, downstream of whatever text `extracted_items.content` ends up holding. If which batch a given source item lands in shifts between runs — because new items were added and batch boundaries got recomputed, or because ordering isn't stable — the same real-world fact could get worded differently run to run for reasons that have nothing to do with the source material changing, and carry-forward's matching would be trying to compensate for batching noise instead of real change. Concretely: batch assignment must be append-only — a new source item can start a new batch or join a not-yet-full one, but adding new material must never reshuffle which batch an *existing* item already belongs to. Chronological, insertion-ordered batch filling satisfies this; anything that recomputes batch boundaries from scratch on each run does not.

**Sequencing: this must be built and validated before flag-resolution-carry-forward, not alongside or after it.** Carry-forward matches against flags produced by the Flag pass — which this work restructures from one call into two phases. Building carry-forward against today's single-call Flag output would mean building it again against the new shape once batching lands. Batching goes first.

## Decision: Path 3 (batching)

Chosen deliberately without measuring the per-image cost shape (linear vs. accelerating) — that measurement was lost (see below) and isn't being re-run. It doesn't change the answer: whichever shape it turns out to be, batching addresses the actual cost driver rather than tolerating a bigger version of it, and it's the only one of the three paths that does. The shape would only have informed Path 1 (how much headroom a plan upgrade actually buys), and Path 1 was always scoped as a stopgap, not a fix, regardless. Noted explicitly so this isn't mistaken for an oversight later: the shape remains unmeasured, and the decision was made without it, on purpose.

## Working rule going forward: extraction outputs are not disposable test artefacts

`extracted_items` and `flags` rows — including from scratch/test projects — are the evidence base for the product's central claim (that this pipeline finds real contradictions, with real evidence, without an answer key) and must be treated as keep-by-default, not cleaned up as a matter of course. This investigation deleted a scratch test's `extracted_items`/`flags` before a needed sanity check ran against them, which is exactly the failure mode this rule exists to prevent. Source items and project rows created purely for diagnostic purposes are still fine to clean up; extraction *outputs* are not, going forward.

## Design question that must be answered before building, not discovered after

**The problem:** today's single Extract+Organize+Flag call can compose a flag's evidence with direct visual access to an image, because the model that writes `flags.evidence` is the same model that just looked at the image. In the two-phase split, Phase 2 (Flag) never sees images at all — only Phase 1's already-written `extracted_items.content` text. If a contradiction involves something an image shows, Phase 2 can only work from however Phase 1 chose to summarize that image into a short, categorized fact — written without knowing in advance which detail would later matter for a contradiction found against a different batch. That's a real fidelity risk this design introduces, independent of the batch-boundary problem it already solves.

**What a flag cites, concretely:** the evidence field quotes/paraphrases the Phase-1 `extracted_items.content` — the derived fact — never the image directly, since Phase 2 has no access to images at all. `flags.source_item_ids` still correctly includes the original image's id, inherited from the extracted_item's own provenance, so the audit trail back to "this came from image X" is preserved even though Phase 2 never looked at image X itself.

**What the planner sees:** checked against the current UI directly — today, `FlagRow` (`ExtractionView.tsx`) renders only `flag.description` and `flag.evidence`, both plain text. It does not look up or display the image even though `flag.source_item_ids` could point to one. So the planner already never sees the actual photo when resolving a flag — this is unchanged by the split, not a new loss it introduces.

**What this means in practice:** the split doesn't make the planner's experience worse, but it does raise the stakes of something that was already true — the planner is trusting a compressed textual claim about an image's contents, sight unseen, without the model being able to "look again" at the moment a contradiction is actually found. Given that stakes increase, this build should include showing the source image thumbnail alongside any flag whose `source_item_ids` includes one — not deferred as a separate brief. That turns an unverifiable model claim into something the planner can check against the actual photo in one glance, which is the real mitigation for the fidelity risk the split introduces, rather than trying to preserve full visual fidelity through an intermediate text summary.
