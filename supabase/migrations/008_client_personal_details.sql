-- =========================================================================
-- Add commonly used personal fields to clients:
--   date_of_birth, place_of_birth, passport_expires_at
-- passport_expires_at feeds the renewal calendar alongside case expiries.
-- =========================================================================

alter table clients
  add column date_of_birth       date,
  add column place_of_birth      text,
  add column passport_expires_at date;

-- Renewal-calendar index: only rows with a real expiry we're not archiving
create index clients_passport_expiry_idx
  on clients (passport_expires_at)
  where passport_expires_at is not null and deleted_at is null;
