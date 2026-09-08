-- Add a fourth schedule shape: `rolling`.
--
-- The three we had (one_off, annual_fixed, quarterly_fixed) all anchor to
-- the calendar or to nothing. Virtual offices — the clearest subscription
-- Almardini sells — anchor to *each customer's own start date*: a 12-month
-- VO bought on March 4 renews on March 4, not on any global date. Forcing
-- VO into `annual_fixed` demanded a fake global date; leaving it `one_off`
-- pretended it doesn't renew at all.
--
-- `rolling` means: the next cycle is (previous expiry OR today) + validity.
-- Uses the existing validity_amount + validity_unit for the term. No new
-- columns; the per-entity cycle already lives in entity_services.expires_date
-- (or cases.expires_at for services worked case-by-case).
--
-- Anything currently set to `one_off` that should actually be `rolling`
-- (VO is the known case) will be re-flagged in the admin UI.

begin;

alter table public.service_types
  drop constraint if exists service_types_schedule_kind_check;

alter table public.service_types
  add constraint service_types_schedule_kind_check
  check (schedule_kind in ('one_off','annual_fixed','quarterly_fixed','rolling'));

-- Rolling requires a validity so we know the term length. Enforce it.
alter table public.service_types
  drop constraint if exists service_types_rolling_fields_check;

alter table public.service_types
  add constraint service_types_rolling_fields_check check (
    (schedule_kind <> 'rolling')
    or (
      validity_amount is not null
      and validity_amount > 0
      and validity_unit in ('days','months','years')
    )
  );

comment on constraint service_types_rolling_fields_check on public.service_types is
  'Rolling schedules must declare a term (validity_amount + validity_unit).';

commit;
