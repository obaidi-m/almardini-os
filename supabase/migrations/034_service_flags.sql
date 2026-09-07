-- Service catalog flags (Step 1 of the Services refactor).
--
-- Three simple flags on `service_types` that drive the per-entity Services
-- card and future Add-service form:
--
--   applies_to     — 'person' | 'company' | 'either'
--   tracks_expiry  — the subscription has a fixed end date (VO, KITAS)
--   is_ongoing     — the subscription has no fixed end (reporting)
--
-- Both booleans default false; a service can be one-off (both false),
-- expiring (tracks_expiry=true), or ongoing (is_ongoing=true). Nothing
-- reads these yet — this migration only adds columns.

begin;

alter table service_types
  add column if not exists applies_to text
    check (applies_to in ('person', 'company', 'either'))
    default 'either' not null;

alter table service_types
  add column if not exists tracks_expiry boolean default false not null;

alter table service_types
  add column if not exists is_ongoing boolean default false not null;

comment on column service_types.applies_to is
  'Who this service can be attached to: person, company, or either.';
comment on column service_types.tracks_expiry is
  'True when the subscription has a fixed end date (VO, KITAS, etc.).';
comment on column service_types.is_ongoing is
  'True for ongoing subscriptions with no fixed end (monthly / quarterly / annual reporting).';

commit;
