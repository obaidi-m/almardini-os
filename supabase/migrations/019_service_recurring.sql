-- Recurring services (LKPM quarterly, tax monthly). Same shape as validity —
-- amount + unit. Blank on both = one-off (KITAS, PT PMA setup). Set = the
-- service repeats on that cadence, which future work can use to auto-open
-- the next case and surface it on the Renewals page.

begin;

alter table public.service_types
  add column if not exists recurring_amount int,
  add column if not exists recurring_unit   text;

alter table public.service_types
  drop constraint if exists service_types_recurring_unit_check;
alter table public.service_types
  add constraint service_types_recurring_unit_check
  check (recurring_unit is null or recurring_unit in ('days','months','years'));

alter table public.service_types
  drop constraint if exists service_types_recurring_paired_check;
alter table public.service_types
  add constraint service_types_recurring_paired_check
  check (
    (recurring_amount is null and recurring_unit is null)
    or (recurring_amount is not null and recurring_amount > 0 and recurring_unit is not null)
  );

commit;
