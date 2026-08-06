-- Lets a specific extraction be held from approval at the database level,
-- not just documented — enforced in approve-direction itself (server-side,
-- not a UI-only gate that a direct function call could bypass) and shown
-- to the planner at the point they'd otherwise click Approve.
--
-- First real use: extraction 3579e5a0-a0a5-4ba3-986d-4548cba158de, held
-- because a private detail reaches approve-direction's prompt unfiltered
-- (see flag-resolution-carry-forward-build-brief.md's HOLD note and
-- "Superseding design" section) until source-level sensitivity marking
-- ships.
alter table public.extractions
  add column blocked boolean not null default false,
  add column blocked_reason text;
