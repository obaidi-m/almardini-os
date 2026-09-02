-- Add validity duration to service_types. When a case moves to Done, its
-- expires_at is auto-filled from today + this duration (if the case doesn't
-- already have an expires_at). Renewals show up on the renewals calendar
-- from there.
--
-- Two columns instead of a Postgres interval:
--   - `validity_amount` : positive integer, null for one-off services
--   - `validity_unit`   : one of 'days' | 'months' | 'years'
-- Two columns round-trip cleanly through the admin form (an interval is
-- awkward to edit as text).

begin;

alter table public.service_types
  add column if not exists validity_amount int,
  add column if not exists validity_unit   text;

alter table public.service_types
  drop constraint if exists service_types_validity_unit_check;
alter table public.service_types
  add constraint service_types_validity_unit_check
  check (validity_unit is null or validity_unit in ('days','months','years'));

alter table public.service_types
  drop constraint if exists service_types_validity_paired_check;
alter table public.service_types
  add constraint service_types_validity_paired_check
  check (
    (validity_amount is null and validity_unit is null)
    or (validity_amount is not null and validity_amount > 0 and validity_unit is not null)
  );

commit;
