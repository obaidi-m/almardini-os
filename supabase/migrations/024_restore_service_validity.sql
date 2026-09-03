-- Restore validity_amount / validity_unit on service_types.
--
-- Migration 023 dropped these on the argument that we weren't watching
-- expiries anymore. That turned out to be wrong: the Active Services
-- section on client / company pages, and the visa-renewal reminder on
-- /renewals, both need to know when a one-off service (C1 visa, KITAS)
-- goes stale. Recurring services (LKPM quarterly) already auto-spawn a
-- successor case and don't need validity — validity is specifically for
-- one-off, time-bounded issuances where the case itself is "done" but
-- its output has a shelf life.
--
-- When a case with a validity-bearing service moves to Done, the app
-- (src/app/cases/actions.ts :: autoFillExpiresOnDone) stamps
-- cases.expires_at = today + validity_amount * validity_unit,
-- unless the user already set an explicit expiry.

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
