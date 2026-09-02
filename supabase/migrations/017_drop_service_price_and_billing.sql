-- Remove pricing / billing_cycle from service_types. Both belong in the
-- finance layer that will be added later; keeping them in the service
-- catalog now trains staff to trust numbers that don't drive anything.
-- Currency goes with them (only meaningful next to a price).

begin;

alter table public.service_types
  drop constraint if exists service_types_billing_cycle_check;

alter table public.service_types
  drop column if exists billing_cycle,
  drop column if exists price,
  drop column if exists currency;

commit;
