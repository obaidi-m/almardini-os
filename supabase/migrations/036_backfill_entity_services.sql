-- Backfill entity_services from permits + virtual_offices (Step 3).
--
-- One-way copy. The source tables (`permits`, `virtual_offices`) stay
-- untouched and remain authoritative for the UI until we flip the pages
-- over in Step 4/5. This migration is a safety net around that:
--
--   * If a matching service_types row already exists (matched by name,
--     case-insensitive), we reuse it.
--   * If not, we create one with sensible flags so nothing is lost.
--   * The whole thing only runs when entity_services is empty, so it's
--     safe to re-apply the migration file without duplicating rows.
--
-- After running, the RAISE NOTICE at the end prints the counts so we can
-- eyeball parity with `select count(*) from permits` /
-- `select count(*) from virtual_offices` on the source tables.

begin;

do $$
declare
  existing_count int;
  vo_service_id  uuid;
  vo_category_id uuid;
  permit_category_id uuid;
  other_category_id uuid;
  permits_inserted int := 0;
  vos_inserted     int := 0;
  services_created int := 0;
  batch_count      int := 0;
  kind_record record;
  matched_service uuid;
begin
  -- Guard: if anyone has started using the new table, bail rather than mix.
  select count(*) into existing_count from public.entity_services;
  if existing_count > 0 then
    raise notice 'entity_services already has % row(s); skipping backfill.', existing_count;
    return;
  end if;

  -- Resolve categories we'll fall back to. 'company' for VO, 'immigration'
  -- for permits, 'other' as a final safety net.
  select id into vo_category_id     from public.service_categories where code = 'company';
  select id into permit_category_id from public.service_categories where code = 'immigration';
  select id into other_category_id  from public.service_categories where code = 'other';
  if vo_category_id     is null then vo_category_id     := other_category_id; end if;
  if permit_category_id is null then permit_category_id := other_category_id; end if;

  -- Step A: ensure a "Virtual Office" service catalog entry exists.
  select id into vo_service_id
    from public.service_types
    where lower(name) in ('virtual office', 'virtual offices', 'vo')
    order by is_active desc, created_at asc
    limit 1;

  if vo_service_id is null then
    insert into public.service_types
      (name, category_id, applies_to, tracks_expiry, is_ongoing, has_deliverable, is_active,
       description)
    values
      ('Virtual Office', vo_category_id, 'company', true, false, true, true,
       'Virtual office rental (auto-created during entity_services backfill).')
    returning id into vo_service_id;
    services_created := services_created + 1;
  else
    -- Make sure the flags reflect the new model even on a pre-existing row.
    update public.service_types
      set applies_to    = 'company',
          tracks_expiry = true,
          is_ongoing    = false
      where id = vo_service_id;
  end if;

  -- Step B: for each distinct permit kind, resolve or create a service.
  -- Case-insensitive match on service_types.name; auto-created rows get
  -- the immigration category and person/tracks_expiry flags.
  for kind_record in
    select distinct trim(kind) as kind
      from public.permits
      where deleted_at is null and kind is not null and length(trim(kind)) > 0
  loop
    select id into matched_service
      from public.service_types
      where lower(name) = lower(kind_record.kind)
      order by is_active desc, created_at asc
      limit 1;

    if matched_service is null then
      insert into public.service_types
        (name, category_id, applies_to, tracks_expiry, is_ongoing, has_deliverable, is_active,
         description)
      values
        (kind_record.kind, permit_category_id, 'person', true, false, true, true,
         'Auto-created during entity_services backfill.')
      returning id into matched_service;
      services_created := services_created + 1;
    else
      update public.service_types
        set applies_to    = 'person',
            tracks_expiry = true,
            is_ongoing    = false
        where id = matched_service;
    end if;

    -- Insert one entity_services row per permit of this kind.
    insert into public.entity_services (
      service_id, client_id, status,
      issued_date, expires_date,
      sponsor_company_id, responsible_partner_id,
      drive_folder_url, notes,
      created_by, created_at, updated_at
    )
    select
      matched_service, p.client_id, p.status,
      p.issued_date, p.expires_date,
      p.sponsor_company_id, p.responsible_partner_id,
      p.drive_folder_url, p.notes,
      p.created_by, p.created_at, p.updated_at
    from public.permits p
    where p.deleted_at is null
      and lower(trim(p.kind)) = lower(kind_record.kind);

    get diagnostics batch_count = row_count;
    permits_inserted := permits_inserted + batch_count;
  end loop;

  -- Step C: virtual offices → one row each under the VO service.
  insert into public.entity_services (
    service_id, company_id, status,
    started_date, expires_date,
    tier, term_months,
    responsible_partner_id,
    drive_folder_url, notes,
    created_by, created_at, updated_at
  )
  select
    vo_service_id, v.company_id, v.status,
    v.start_date, v.end_date,
    v.tier, v.term_months,
    v.responsible_partner_id,
    v.drive_folder_url, v.notes,
    v.created_by, v.created_at, v.updated_at
  from public.virtual_offices v
  where v.deleted_at is null;

  get diagnostics vos_inserted = row_count;

  raise notice 'Backfill complete: % permit(s), % virtual office(s), % service(s) auto-created.',
    permits_inserted, vos_inserted, services_created;
end$$;

commit;
