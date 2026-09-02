-- Passport expiry: we don't proactively watch it. Staff learn about
-- passport-blocked filings at submission time. Column and every UI usage go.
-- Validity: same reasoning. The auto-fill of case.expires_at from
-- service_types.validity_amount/unit was a nag mechanism aimed at renewals;
-- with passport expiry gone the whole 'warn me' machinery loses its point.
-- Recurring stays — it auto-spawns the next filing case, which is real work
-- automation, not a warning.

alter table clients        drop column if exists passport_expires_at;
alter table service_types  drop column if exists validity_amount;
alter table service_types  drop column if exists validity_unit;
