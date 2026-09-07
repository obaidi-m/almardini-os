-- Entity services (Step 2 of the Services refactor).
--
-- One row per subscription a client or company has with us — regardless of
-- type. Replaces the per-type shape (`permits`, `virtual_offices`, and any
-- future `reports` table) with a single unified store. The catalog entry
-- (`service_types`) determines which fields matter for a row via its flags
-- (`applies_to`, `tracks_expiry`, `is_ongoing`).
--
-- Nothing reads or writes this table yet. Step 3 will backfill from
-- `permits` and `virtual_offices`; Steps 4+ swap the UI over.

begin;

create table if not exists entity_services (
  id uuid primary key default gen_random_uuid(),

  service_id uuid not null references service_types(id) on delete restrict,

  -- Exactly one of client_id / company_id must be set. Enforced by the
  -- CHECK below so an orphan or double-owned row can't exist.
  client_id  uuid references clients(id)   on delete cascade,
  company_id uuid references companies(id) on delete cascade,

  -- Lifecycle state of the subscription itself (not any related case).
  status text not null default 'active'
    check (status in ('active', 'expired', 'terminated', 'paused')),

  -- Dates: which are meaningful depends on the catalog entry's flags.
  --   tracks_expiry → issued_date + expires_date
  --   is_ongoing    → started_date
  started_date date,
  issued_date  date,
  expires_date date,

  -- VO-shaped extras. Nullable because most services don't use them.
  tier         text,
  term_months  int,

  -- Optional references — reused from the existing permits / VO shape.
  sponsor_company_id     uuid references companies(id) on delete set null,
  responsible_partner_id uuid references partners(id)  on delete set null,

  drive_folder_url text,
  notes            text,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint entity_services_owner_xor
    check ((client_id is not null) <> (company_id is not null))
);

create index if not exists entity_services_client_idx
  on entity_services(client_id) where deleted_at is null;
create index if not exists entity_services_company_idx
  on entity_services(company_id) where deleted_at is null;
create index if not exists entity_services_service_idx
  on entity_services(service_id) where deleted_at is null;
create index if not exists entity_services_expiring_idx
  on entity_services(expires_date) where deleted_at is null and status = 'active';

-- Keep updated_at fresh on any change.
create or replace function touch_entity_services_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists entity_services_touch_updated_at on entity_services;
create trigger entity_services_touch_updated_at
  before update on entity_services
  for each row execute function touch_entity_services_updated_at();

-- RLS: mirror the permits / virtual_offices policies so the same people
-- who manage clients & companies can manage their subscriptions.
alter table public.entity_services enable row level security;

drop policy if exists entity_services_read  on public.entity_services;
drop policy if exists entity_services_write on public.entity_services;

create policy entity_services_read on public.entity_services
  for select to authenticated
  using (deleted_at is null or is_owner());

create policy entity_services_write on public.entity_services
  for all to authenticated
  using (
    is_owner()
    or has_permission('clients.create')  or has_permission('clients.update')
    or has_permission('companies.create') or has_permission('companies.update')
  )
  with check (
    is_owner()
    or has_permission('clients.create')  or has_permission('clients.update')
    or has_permission('companies.create') or has_permission('companies.update')
  );

commit;
