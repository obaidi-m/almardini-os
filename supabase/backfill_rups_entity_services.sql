-- Backfill entity_services rows for every company/client that has an open
-- RUPS case but no active entity_service for RUPS yet.
--
-- Run in the Supabase SQL editor. Wrapped in a transaction so you can
-- roll it back if the preview count doesn't look right.
--
-- "Open" = any case status other than 'delivered' (new / in_progress / done).
-- Change the status filter below if you want a different definition.

begin;

with rups as (
  select id from service_types where code = 'RUPS' limit 1
),
targets as (
  select distinct c.company_id, c.client_id
  from cases c
  join rups r on c.service_type_id = r.id
  where c.deleted_at is null
    and c.status <> 'delivered'
)
insert into entity_services (service_id, client_id, company_id, status)
select r.id, t.client_id, t.company_id, 'active'
from targets t
cross join rups r
where not exists (
  select 1
  from entity_services es
  where es.service_id = r.id
    and es.deleted_at is null
    and (
      (t.client_id  is not null and es.client_id  = t.client_id)  or
      (t.company_id is not null and es.company_id = t.company_id)
    )
)
returning id, client_id, company_id;

-- Sanity: how many owners will get a RUPS entity_service after this runs?
-- Compare with the count of returned rows above.
select count(distinct coalesce(client_id::text, company_id::text)) as owners_with_rups
from entity_services es
join service_types s on s.id = es.service_id
where s.code = 'RUPS'
  and es.deleted_at is null
  and es.status = 'active';

-- If the numbers look right, replace this line with:  commit;
rollback;
