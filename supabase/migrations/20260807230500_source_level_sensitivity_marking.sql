-- Phase B: source-level sensitivity marking (source-level-sensitivity-build-brief.md).
--
-- exclude_from_direction is the single planner-set mark. Everything else in
-- the pipeline (extracted_items, flags) is derived from it at read time via
-- array overlap against source_item_ids, never materialised onto those
-- rows — see the brief's §2.1. A source marked after extraction still
-- propagates correctly, and re-extraction (which regenerates
-- extracted_items/flags with new ids, per the brief's §4 findings) never
-- wipes it, because nothing is ever written to the regenerated rows in the
-- first place.
--
-- Named distinctly from flags.internal_only on purpose (brief §2.3): that
-- field is instruction-level — the marked flag's text still enters
-- approve-direction's prompt, with an instruction not to restate it, so the
-- model can summarise it into planner_notes. This field is structural — the
-- two views below mean excluded content never enters the prompt at all.
-- Same word would have implied the same strength of guarantee, and they are
-- not the same strength.
alter table public.source_items
  add column exclude_from_direction boolean not null default false,
  add column excluded_at timestamptz,
  add column excluded_note text;

-- Derivation views. No consumers yet — approve-direction is wired to these
-- in Phase C, not here.
--
-- security_invoker preserves each caller's own row-level security. Without
-- it, a view runs with its owner's privileges and could silently bypass
-- RLS — exactly the kind of regression this build exists to prevent, not
-- introduce.
--
-- ei.source_item_ids / f.source_item_ids only ever contain ids from
-- source_items belonging to the same project — extract-facts and
-- flag-facts both filter cited ids against a known-ids set scoped to the
-- current extraction's own project before insert. So overlapping against
-- the full, cross-project excluded-id set below cannot leak across
-- projects: an id belonging to another project's source_items simply never
-- appears in either array to begin with.
create view public.extracted_items_with_sensitivity
  with (security_invoker = true) as
select
  ei.*,
  ei.source_item_ids && (
    select coalesce(array_agg(id), '{}'::uuid[])
    from public.source_items
    where exclude_from_direction
  ) as is_excluded
from public.extracted_items ei;

create view public.flags_with_sensitivity
  with (security_invoker = true) as
select
  f.*,
  f.source_item_ids && (
    select coalesce(array_agg(id), '{}'::uuid[])
    from public.source_items
    where exclude_from_direction
  ) as is_excluded
from public.flags f;
