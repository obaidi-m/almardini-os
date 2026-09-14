-- =========================================================================
-- Backfill entity_services.sponsor_company_id from client_companies.
--
-- For every person-owned permit that has no guarantor set, look up the
-- clients they were previously linked to via client_companies. If they
-- are linked to exactly ONE company, use that as the guarantor. If they
-- are linked to multiple, skip — we can't guess which one; the operator
-- will pick manually from the Guarantor dropdown.
--
-- Safe to re-run: the WHERE clause only touches rows where sponsor is
-- still null.
-- =========================================================================

begin;

with candidates as (
  select
    es.id                   as permit_id,
    (array_agg(cc.company_id))[1] as company_id,
    count(distinct cc.company_id) as company_count
  from public.entity_services es
  join public.client_companies cc on cc.client_id = es.client_id
  where es.sponsor_company_id is null
    and es.client_id is not null
    and es.deleted_at is null
  group by es.id
)
update public.entity_services es
   set sponsor_company_id = c.company_id,
       updated_at = now()
  from candidates c
 where es.id = c.permit_id
   and c.company_count = 1;

commit;
