-- Add billing cycle to service catalog.
-- Some services are one-time (KITAS, PT PMA), others are recurring
-- (virtual office monthly, LKPM quarterly, annual PT PMA report).

alter table service_types
  add column if not exists billing_cycle text not null default 'one_time';

-- Only allow known cycles
alter table service_types
  drop constraint if exists service_types_billing_cycle_check;

alter table service_types
  add constraint service_types_billing_cycle_check
  check (billing_cycle in ('one_time', 'monthly', 'quarterly', 'annually'));
