-- Add "bronze" as the entry-level VO tier.

begin;

alter table public.virtual_offices
  drop constraint if exists virtual_offices_tier_check;

alter table public.virtual_offices
  add constraint virtual_offices_tier_check
  check (tier in ('bronze','silver','gold','platinum'));

commit;
