-- Widen the quarterly_fixed months array from 1-4 to 1-12.
--
-- Motivation: "Monthly" is the same shape as "Quarterly" — same day-of-month,
-- just applied to more anchor months. Rather than invent a separate
-- `monthly_fixed` kind (and a duplicate day/month pair to maintain), monthly
-- is now expressed as quarterly_fixed with all 12 months ticked. The UI
-- shows a Monthly/Quarterly toggle that flips between the two typical
-- shapes; the DB just sees "an array of anchor months, 1-12 long."

begin;

alter table public.service_types
  drop constraint if exists service_types_quarterly_fields_check;

alter table public.service_types
  add constraint service_types_quarterly_fields_check check (
    (schedule_kind <> 'quarterly_fixed')
    or (
      quarterly_day between 1 and 31
      and quarterly_months is not null
      and array_length(quarterly_months, 1) between 1 and 12
    )
  );

comment on constraint service_types_quarterly_fields_check on public.service_types is
  'Quarterly-shaped services carry 1-12 anchor months; 12 means monthly.';

commit;
