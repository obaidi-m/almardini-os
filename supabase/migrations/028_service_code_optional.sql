-- Make service code optional. Some services (virtual office, ad-hoc
-- one-offs) don't have a natural short code — for those, the name alone
-- is enough. Every display site already falls back gracefully when the
-- code is missing (see src/lib/service.ts::serviceLabel).
--
-- Unique constraint is kept: Postgres allows multiple NULLs in a UNIQUE
-- column, so several codeless services coexist while any non-null code
-- stays unique.

begin;

alter table public.service_types
  alter column code drop not null;

commit;
