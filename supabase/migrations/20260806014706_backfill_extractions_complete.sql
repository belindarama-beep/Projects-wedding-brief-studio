-- The 3 pre-batching extractions ran under the old single-call architecture
-- and completed successfully (they have flags) — the new status column's
-- default of 'running' would misrepresent them as abandoned.
update public.extractions set status = 'complete';
