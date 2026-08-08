# Phase E1 verification — the feed-forward rule, captured not observed

Regression test for the E1 fix to `approve-direction`'s `previousApproved` handling, per `source-level-sensitivity-build-brief.md` Phase E. Same method as `phase-c-verification/`: the claim being verified is *absence*, so it's proven as a `diff`/`grep` over a captured, rendered prompt file, not a log scan.

Phase C closed the `extracted_items`/`flags` leak paths but deliberately left `previousApproved.content` open as a documented `KNOWN GAP` — a stored approved `direction_versions` row re-enters the prompt on every later approval regardless of what gets marked afterward. E1 closes it: `previousApproved` no longer feeds into the prompt if it was approved *before* the most recent `excluded_at` on any of the project's `source_items`.

## What's here — and what deliberately isn't

- `render-prompt.mjs` — mirrors `approve-direction`'s prompt-assembly logic post-E1, including the feed-forward rule. Unlike `phase-c-verification/render-prompt.mjs` (which omits `previousApproved` on purpose, to isolate Phase C's own filter), this one includes it deliberately — it's exactly the mechanism under test here. The payload additionally carries `previous_approved` (the latest approved `direction_versions` row) and `source_items` (each row's `excluded_at`), since the rule needs both.

**Not checked in, enforced by `.gitignore`:** `before.json`, `after.json`, `prompt-before.txt`, `prompt-after.txt` — real Arden & Theo data, including a real approved direction's real `planner_notes`. Same reasoning as Phase C: committing it would create a permanent copy of exactly the content this build exists to contain.

**Checked in instead:** `synthetic-before.json` / `synthetic-after.json` and their rendered `synthetic-prompt-before.txt` / `synthetic-prompt-after.txt` — fabricated data, extending Phase C's "Fixture Couple" fixture with a fabricated `previous_approved` and `source_items`.

## What it proved

Run against Arden & Theo's real extraction `3579e5a0`, project `e54ce663-ec70-42ad-93fb-b2b753f8c52a`, latest approved version 13 (approved 2026-08-05T09:41:57.943+00:00) — source `39319398` marked, captured, unmarked immediately after (`UPDATE ... SET exclude_from_direction = false, excluded_at = null, excluded_note = null`), live project left unmodified.

```
diff prompt-before.txt prompt-after.txt
```

removed exactly 3 lines from the `extracted_items`/flag sections — same mechanism Phase C already proved, reconfirmed here — **and** replaced the entire `Previous approved direction (version 13, ...)` block (the full JSON-stringified content of v13, including its `planner_notes`) with `This is the first approved direction for this project. There is no previous version.`

```
grep -c "does not want her mother making styling decisions" prompt-before.txt   # 1
grep -c "does not want her mother making styling decisions" prompt-after.txt    # 0
grep -c "mother" prompt-before.txt                                              # 4
grep -c "mother" prompt-after.txt                                               # 0
```

One correction to the Phase C report worth recording precisely, since captured-artifact verification is about exactness: the literal phrase "does not want her mother making styling decisions" that Phase C originally grepped for lives in `extracted_items`/`flags` (Phase C's own mechanism, 3 of the 4 "mother" occurrences), not in v13's `planner_notes` — that field paraphrases the same topic ("Arden's mother is funding the flowers... Decision-making authority is not formally confirmed... Settle governance before floral spend is committed") rather than repeating the phrase verbatim. It's the 4th occurrence, inside the `previousApproved` JSON block, that E1 specifically removes. Both are now zero in the "after" payload; the distinction matters only for knowing which mechanism was responsible for which line.

## Synthetic fixture — same proof, fabricated data, committed

```
diff synthetic-prompt-before.txt synthetic-prompt-after.txt
```

removes exactly 2 lines (Phase C's mechanism, reused unchanged from that fixture) plus the entire `previousApproved` block (E1's mechanism).

```
grep -c "quietly funding the catering" synthetic-prompt-before.txt   # 3
grep -c "quietly funding the catering" synthetic-prompt-after.txt    # 0
```

A future CI step can assert this pair's diff line-count and grep result directly, same as the Phase C fixture — not wired up here, but mechanical to add.

## Reproducing the real-data check after a future change

1. Pick a project with at least one approved `direction_versions` row and a real source with sensitive content, or use `3579e5a0` / `39319398` / project `e54ce663-ec70-42ad-93fb-b2b753f8c52a` again.
2. Capture the "before" payload: `extracted_items_with_sensitivity` / `flags_with_sensitivity` (`is_excluded = false`), `resolutions`, the latest approved `direction_versions` row as `previous_approved`, and every `source_items` row's `excluded_at` for the project — before marking anything.
3. `UPDATE source_items SET exclude_from_direction = true, excluded_at = now(), excluded_note = '...' WHERE id = '...'`, capture the "after" payload with the same shape, then immediately revert the `UPDATE` (`exclude_from_direction = false, excluded_at = null, excluded_note = null`) so the live project is left unmodified.
4. `node render-prompt.mjs <payload>.json <output>.txt` for each.
5. `diff` the two outputs — confirm the `previousApproved` block is entirely absent from "after" (not merely edited) whenever the marked source's `excluded_at` postdates `previous_approved.approved_at`. `grep -c` the sensitive substring in the "after" file, confirm zero.

If `render-prompt.mjs` drifts from `index.ts`'s actual prompt-assembly or feed-forward logic, this stops being a faithful test — keep them in sync when either changes.
