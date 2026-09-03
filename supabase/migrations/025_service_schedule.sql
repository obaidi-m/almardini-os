-- Replace interval-recurring services with calendar-fixed schedules.
--
-- The old model (recurring_amount + recurring_unit = "every N months after
-- done") drifted whenever a filing was late: a Sep 30 RUPS finished on Oct 15
-- would push the next deadline to Oct 15 next year, when the real statutory
-- deadline is still Sep 30. Indonesian filings we care about (LKPM, RUPS,
-- SPT Tahunan, BPJS) are all anchored to the calendar, not to when we
-- happened to close the last case.
--
-- New model — `schedule_kind` on service_types decides how the auto-fill of
-- cases.expires_at works when a case moves to Done:
--   'one_off'          : no recurrence. Optional validity_amount/unit still
--                        stamps a shelf-life expiry (visa, KITAS).
--   'annual_fixed'     : one date per year. annual_month (1-12) + annual_day
--                        (1-31). Next occurrence = next such date after today.
--   'quarterly_fixed'  : same day-of-month across four months. quarterly_day
--                        (1-31) + quarterly_months int[] (defaults to
--                        {1,4,7,10}). Next occurrence = next entry.
--
-- Interval-recurring is removed. Any service currently on it becomes
-- one_off; the owner reconfigures it in Admin → Service catalog. LKPM will
-- be set to quarterly_fixed with day=10, months={1,4,7,10}. RUPS to
-- annual_fixed 9/30. SPT Tahunan to annual_fixed 3/31.

begin;

alter table public.service_types
  add column if not exists schedule_kind text
    check (schedule_kind in ('one_off','annual_fixed','quarterly_fixed'))
    default 'one_off' not null,
  add column if not exists annual_month     int,
  add column if not exists annual_day       int,
  add column if not exists quarterly_day    int,
  add column if not exists quarterly_months int[];

-- Paired-check constraints so a row can't half-declare a schedule.
alter table public.service_types
  drop constraint if exists service_types_annual_fields_check;
alter table public.service_types
  add constraint service_types_annual_fields_check check (
    (schedule_kind <> 'annual_fixed')
    or (annual_month between 1 and 12 and annual_day between 1 and 31)
  );

alter table public.service_types
  drop constraint if exists service_types_quarterly_fields_check;
alter table public.service_types
  add constraint service_types_quarterly_fields_check check (
    (schedule_kind <> 'quarterly_fixed')
    or (
      quarterly_day between 1 and 31
      and quarterly_months is not null
      and array_length(quarterly_months, 1) between 1 and 4
    )
  );

-- Drop the old interval-recurring columns. Any service that was set up
-- with them is now schedule_kind='one_off' (the default above) and needs
-- to be re-saved in the admin form. Nothing downstream reads these
-- anymore — every caller in the app was updated in the same commit.
alter table public.service_types drop column if exists recurring_amount;
alter table public.service_types drop column if exists recurring_unit;

commit;
