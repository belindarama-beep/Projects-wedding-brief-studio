-- Batching support for the Extract stage (extract-facts-timeout-brief.md, Path 3).
--
-- batch_index: persisted, append-only assignment of a source_item to its
-- pool's batch (pool = 'image' if type = 'image', else the shared text pool).
-- Set once when an item is first batched by insertion-ordered filling, never
-- recomputed from the full list on a later run — deleting an item must not
-- shift any other item's batch_index. This is what flag-resolution
-- carry-forward's matcher depends on being stable across runs.
alter table public.source_items
  add column batch_index integer;

-- status: distinguishes a run that completed (flags written) from one that
-- was abandoned mid-way (e.g. tab closed between batch calls) — the
-- multi-call batching design leaves orphaned extracted_items under a
-- 'running' extraction that never reaches 'complete' in that case. Not
-- cleaned up automatically; this makes that state diagnosable rather than a
-- silent mystery.
alter table public.extractions
  add column status text not null default 'running'
    check (status = any (array['running'::text, 'complete'::text]));

create index if not exists source_items_batch_lookup
  on public.source_items (project_id, type, batch_index);
