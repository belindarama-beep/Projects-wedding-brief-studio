# Phase C verification — captured, not just observed

Regression test for `approve-direction`'s prompt assembly, per `source-level-sensitivity-build-brief.md` Phase C. The claim being verified is *absence* — that specific content does not appear anywhere in the assembled prompt payload — and absence is exactly what a human scan of a log line misses. This captures both prompts as files so the check is a `diff`/`grep`, not an eyeball.

## What's here — and what deliberately isn't

- `render-prompt.mjs` — mirrors `approve-direction`'s prompt-assembly logic (the `promptLines` construction, `visibleFlags`/`internalOnlyFlags` bucketing) against a captured payload. Deliberately omits the `previousApproved` section — that's a separate, confirmed-but-unfixed leak path (see the Phase C report / the `KNOWN GAP` comment in `index.ts`), and including it here would make the grep-returns-zero result ambiguous about which mechanism a match came from. This isolates exactly what Phase C's filter changes.

**Not checked in:** the actual captured payloads and rendered prompts (`before.json`, `after.json`, `prompt-before.txt`, `prompt-after.txt`) from the run this was verified against. Those contained Arden & Theo's real sensitive material verbatim — the "before" capture necessarily does, that's what it's testing the absence of — and committing that into git would create a new, permanent copy of exactly the content this build exists to contain, regardless of later deletion. They were generated into the scratchpad, used for the diff/grep below, and discarded, not committed. Regenerate them locally per "Reproducing this" if you need to re-run the check; don't commit what you generate.

## What it proved

Run once against Arden & Theo's real extraction `3579e5a0`, source `39319398` (the one carrying "Arden does not want her mother making styling decisions") — marked, captured, unmarked immediately after, live project left unmodified.

```
diff prompt-before.txt prompt-after.txt
```
removed exactly 3 lines: the one `extracted_item` citing the marked source, and the two flags (a contradiction and a gap) that also cited it. Nothing else changed.

```
grep -c "does not want her mother making styling decisions" prompt-before.txt   # 1
grep -c "does not want her mother making styling decisions" prompt-after.txt    # 0
grep -c "mother" prompt-after.txt                                               # 0
```

Not just the exact phrase — the word "mother" does not appear anywhere in the marked prompt at all.

## Reproducing this after a future change

1. Pick a real extraction and a real source with sensitive content, or use `3579e5a0` / `39319398` again.
2. Capture the `is_excluded = false` payload from `extracted_items_with_sensitivity` / `flags_with_sensitivity` for that extraction — before and after marking the source (see the Phase C report in `source-level-sensitivity-build-brief.md` for the exact queries used).
3. `node render-prompt.mjs <payload>.json <output>.txt` for each.
4. `diff` the two outputs, `grep -c` the sensitive substring in the "after" file, confirm zero.

If `render-prompt.mjs` drifts from `index.ts`'s actual prompt-assembly logic, this stops being a faithful test — keep them in sync when `approve-direction`'s prompt construction changes.
