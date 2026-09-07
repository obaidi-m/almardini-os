-- Step 9 cleanup: drop the legacy per-type storage tables.
--
-- entity_services (migration 035) has been the single source of truth
-- since the Step 5 flip: /permits, /virtual-offices, /renewals, the
-- dashboard renewals panel, and both entity detail pages all read from
-- it. permits (033) and virtual_offices (029) are no longer read by any
-- code, only written to by dead code paths that this migration retires
-- alongside the tables.
--
-- Every row was copied into entity_services by the Step 3 backfill and
-- has been the live copy ever since. Dropping the source tables removes
-- the second copy that would drift on every new subscription.

begin;

drop table if exists public.permits         cascade;
drop table if exists public.virtual_offices cascade;

commit;
