-- =========================================================================
-- Almardini Ops — Operations core
-- Adds: clients, companies, partners, cases, case_updates, settings, i18n on service_types
-- Depends on: 001_initial_schema.sql (users, roles, activity_log, helpers)
-- =========================================================================

-- -----------------------------------------------------------------------
-- SETTINGS (admin-editable key/value, incl. ID prefixes)
-- -----------------------------------------------------------------------
create table settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now()
);

create trigger settings_updated before update on settings
  for each row execute function set_updated_at();

insert into settings (key, value, description) values
  ('id_prefix_client',  '"CLI"'::jsonb, 'Prefix for human-readable client IDs. Locked once first client exists.'),
  ('id_prefix_company', '"CMP"'::jsonb, 'Prefix for human-readable company IDs. Locked once first company exists.'),
  ('id_prefix_case',    '"CAS"'::jsonb, 'Prefix for human-readable case IDs. Locked once first case exists.'),
  ('id_prefix_partner', '"PRT"'::jsonb, 'Prefix for human-readable partner IDs. Locked once first partner exists.'),
  ('default_language',  '"en"'::jsonb,  'Default UI language when a user has not chosen one.'),
  ('timezone',          '"Asia/Jakarta"'::jsonb, 'Display timezone for all times in the app.');

-- -----------------------------------------------------------------------
-- I18N + DELIVERY ON SERVICE TYPES
-- -----------------------------------------------------------------------
alter table service_types
  add column name_id              text,
  add column description_id       text,
  add column has_deliverable      boolean not null default true,
  add column delivery_template_en text,
  add column delivery_template_id text;

-- keep `name` as English canonical for now; UI reads `name_id` when lang = id, else `name`

-- -----------------------------------------------------------------------
-- USER PREFERENCES (language toggle)
-- -----------------------------------------------------------------------
alter table users add column language text not null default 'en' check (language in ('en','id'));

-- =========================================================================
-- CLIENTS
-- =========================================================================
create sequence client_code_seq start 1;

create table clients (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,   -- e.g. 'CLI-0001'
  full_name            text not null,
  nationality          text,
  passport_no          text,
  phone                text,
  email                text,
  preferred_channel    text check (preferred_channel in ('whatsapp','email')) default 'whatsapp',
  introduced_by_partner_id uuid,               -- fk added after partners table
  notes                text,
  deleted_at           timestamptz,
  created_by           uuid references users(id),
  updated_by           uuid references users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index clients_passport_unique
  on clients (lower(passport_no)) where passport_no is not null and deleted_at is null;
create index clients_name_idx on clients using gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(passport_no,'')));
create index clients_active_idx on clients (deleted_at) where deleted_at is null;

create trigger clients_updated before update on clients
  for each row execute function set_updated_at();

-- Assign human-readable code on insert
create or replace function assign_client_code()
returns trigger language plpgsql as $$
declare prefix text;
begin
  if new.code is null or new.code = '' then
    select value #>> '{}' into prefix from settings where key = 'id_prefix_client';
    new.code := coalesce(prefix,'CLI') || '-' || lpad(nextval('client_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create trigger clients_code before insert on clients
  for each row execute function assign_client_code();

-- =========================================================================
-- COMPANIES (PT PMA and similar)
-- =========================================================================
create sequence company_code_seq start 1;

create table companies (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,     -- e.g. 'CMP-0001'
  name               text not null,
  nib                text,                     -- Nomor Induk Berusaha
  incorporation_date date,
  address            text,
  license_expires_at date,                     -- for renewal calendar
  notes              text,
  deleted_at         timestamptz,
  created_by         uuid references users(id),
  updated_by         uuid references users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index companies_name_idx on companies using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(nib,'')));
create index companies_active_idx on companies (deleted_at) where deleted_at is null;
create index companies_license_expiry_idx on companies (license_expires_at) where license_expires_at is not null and deleted_at is null;

create trigger companies_updated before update on companies
  for each row execute function set_updated_at();

create or replace function assign_company_code()
returns trigger language plpgsql as $$
declare prefix text;
begin
  if new.code is null or new.code = '' then
    select value #>> '{}' into prefix from settings where key = 'id_prefix_company';
    new.code := coalesce(prefix,'CMP') || '-' || lpad(nextval('company_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create trigger companies_code before insert on companies
  for each row execute function assign_company_code();

-- =========================================================================
-- CLIENT ↔ COMPANY LINK
-- =========================================================================
create table client_companies (
  client_id   uuid not null references clients(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  role        text not null check (role in ('owner','shareholder','director','other')),
  created_at  timestamptz not null default now(),
  primary key (client_id, company_id, role)
);

create index client_companies_company_idx on client_companies(company_id);

-- =========================================================================
-- PARTNERS (referrers + agents in one table)
-- =========================================================================
create sequence partner_code_seq start 1;

create table partners (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,     -- e.g. 'PRT-0001'
  name           text not null,
  type           text not null check (type in ('referrer','agent','both')),
  contact_person text,
  phone          text,
  email          text,
  notes          text,
  deleted_at     timestamptz,
  created_by     uuid references users(id),
  updated_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index partners_name_idx on partners using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(contact_person,'')));
create index partners_active_idx on partners (deleted_at) where deleted_at is null;

create trigger partners_updated before update on partners
  for each row execute function set_updated_at();

create or replace function assign_partner_code()
returns trigger language plpgsql as $$
declare prefix text;
begin
  if new.code is null or new.code = '' then
    select value #>> '{}' into prefix from settings where key = 'id_prefix_partner';
    new.code := coalesce(prefix,'PRT') || '-' || lpad(nextval('partner_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create trigger partners_code before insert on partners
  for each row execute function assign_partner_code();

-- Now add the deferred FK from clients → partners
alter table clients
  add constraint clients_introduced_by_fk
  foreign key (introduced_by_partner_id) references partners(id);

-- =========================================================================
-- CASES (the unit of work)
-- =========================================================================
create sequence case_code_seq start 1;

create table cases (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,     -- e.g. 'CAS-0001'
  client_id        uuid not null references clients(id),
  company_id       uuid references companies(id),                -- nullable (personal cases)
  service_type_id  uuid not null references service_types(id),
  partner_id       uuid references partners(id),
  partner_role     text check (partner_role in ('referrer','agent')),
  status           text not null default 'new'
                     check (status in ('new','in_progress','done','ready','delivered')),
  priority         text not null default 'normal'
                     check (priority in ('low','normal','high','urgent')),
  assigned_to      uuid references users(id),
  deadline         date,
  expires_at       date,                                        -- for renewal calendar (KITAS/KITAP expiry)
  recurring_interval text check (recurring_interval in ('quarterly','annually')),
  title            text,                                        -- optional one-line label
  deleted_at       timestamptz,
  created_by       uuid references users(id),
  updated_by       uuid references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index cases_client_idx on cases(client_id);
create index cases_company_idx on cases(company_id) where company_id is not null;
create index cases_service_idx on cases(service_type_id);
create index cases_partner_idx on cases(partner_id) where partner_id is not null;
create index cases_status_idx on cases(status);
create index cases_assigned_idx on cases(assigned_to) where assigned_to is not null;
create index cases_deadline_idx on cases(deadline) where deadline is not null;
create index cases_expiry_idx on cases(expires_at) where expires_at is not null and deleted_at is null;
create index cases_active_idx on cases(deleted_at) where deleted_at is null;

create trigger cases_updated before update on cases
  for each row execute function set_updated_at();

create or replace function assign_case_code()
returns trigger language plpgsql as $$
declare prefix text;
begin
  if new.code is null or new.code = '' then
    select value #>> '{}' into prefix from settings where key = 'id_prefix_case';
    new.code := coalesce(prefix,'CAS') || '-' || lpad(nextval('case_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create trigger cases_code before insert on cases
  for each row execute function assign_case_code();

-- =========================================================================
-- CASE UPDATES (the work log)
-- Immutable: no update/delete allowed (enforced by trigger + policy).
-- =========================================================================
create table case_updates (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references cases(id) on delete cascade,
  author_id     uuid not null references users(id),
  text          text not null,
  status_before text check (status_before in ('new','in_progress','done','ready','delivered')),
  status_after  text check (status_after  in ('new','in_progress','done','ready','delivered')),
  attachment_path text,      -- Supabase Storage path, e.g. 'cases/<case_id>/2026-08-28_visa.pdf'
  attachment_name text,      -- original filename for display
  attachment_size int,       -- bytes
  attachment_mime text,      -- 'application/pdf', 'image/png', etc.
  created_at    timestamptz not null default now()
);

create index case_updates_case_idx on case_updates(case_id, created_at desc);
create index case_updates_author_idx on case_updates(author_id);
create index case_updates_text_idx on case_updates using gin (to_tsvector('simple', text));

-- Immutability: block updates and deletes
create or replace function prevent_case_update_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'case_updates are immutable — create a new update instead';
end $$;

create trigger case_updates_no_update before update on case_updates
  for each row execute function prevent_case_update_mutation();
create trigger case_updates_no_delete before delete on case_updates
  for each row execute function prevent_case_update_mutation();

-- =========================================================================
-- HELPER FUNCTIONS FOR RLS
-- =========================================================================

-- Current user's role code
create or replace function current_role_code()
returns text language sql stable as $$
  select r.code from users u
  join roles r on r.id = u.role_id
  where u.id = auth.uid()
$$;

-- Can current user see delivered cases?
create or replace function can_see_delivered()
returns boolean language sql stable as $$
  select current_role_code() in ('owner','ops_lead') or is_owner()
$$;

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
alter table settings         enable row level security;
alter table clients          enable row level security;
alter table companies        enable row level security;
alter table client_companies enable row level security;
alter table partners         enable row level security;
alter table cases            enable row level security;
alter table case_updates     enable row level security;

-- Settings: everyone reads, only owner writes
create policy settings_read  on settings for select to authenticated using (true);
create policy settings_write on settings for all    to authenticated using (is_owner()) with check (is_owner());

-- Clients: authenticated users read; ops-level roles write
create policy clients_read on clients for select to authenticated using (deleted_at is null or is_owner());
create policy clients_write on clients for all to authenticated
  using (is_owner() or has_permission('clients.create') or has_permission('clients.update') or has_permission('clients.delete'))
  with check (is_owner() or has_permission('clients.create') or has_permission('clients.update'));

-- Companies: same pattern as clients
create policy companies_read on companies for select to authenticated using (deleted_at is null or is_owner());
create policy companies_write on companies for all to authenticated
  using (is_owner() or has_permission('clients.create') or has_permission('clients.update'))
  with check (is_owner() or has_permission('clients.create') or has_permission('clients.update'));

-- Client-Company links: read to all, write to ops
create policy client_companies_read  on client_companies for select to authenticated using (true);
create policy client_companies_write on client_companies for all    to authenticated
  using (is_owner() or has_permission('clients.update'))
  with check (is_owner() or has_permission('clients.update'));

-- Partners: authenticated reads active; ops writes
create policy partners_read on partners for select to authenticated using (deleted_at is null or is_owner());
create policy partners_write on partners for all to authenticated
  using (is_owner() or has_permission('referrers.create') or has_permission('referrers.update'))
  with check (is_owner() or has_permission('referrers.create') or has_permission('referrers.update'));

-- Cases:
--   read.all      → sees every non-delivered case (delivered gated by can_see_delivered)
--   read.own      → sees only their assigned cases
--   ops_lead/owner→ sees everything including delivered
create policy cases_read on cases for select to authenticated using (
  deleted_at is null and (
    can_see_delivered()
    or (status <> 'delivered' and (
         has_permission('cases.read.all')
         or (has_permission('cases.read.own') and assigned_to = auth.uid())
       ))
  )
);

create policy cases_insert on cases for insert to authenticated
  with check (is_owner() or has_permission('cases.create'));

create policy cases_update on cases for update to authenticated
  using (
    is_owner()
    or has_permission('cases.update.all')
    or (has_permission('cases.update.own') and assigned_to = auth.uid())
  )
  with check (
    is_owner()
    or has_permission('cases.update.all')
    or (has_permission('cases.update.own') and assigned_to = auth.uid())
  );

create policy cases_delete on cases for delete to authenticated
  using (is_owner() or has_permission('cases.delete'));

-- Case updates: read follows the case; insert by anyone who can see the case
create policy case_updates_read on case_updates for select to authenticated using (
  exists (
    select 1 from cases c
    where c.id = case_updates.case_id
      and c.deleted_at is null
      and (
        can_see_delivered()
        or (c.status <> 'delivered' and (
             has_permission('cases.read.all')
             or (has_permission('cases.read.own') and c.assigned_to = auth.uid())
           ))
      )
  )
);

create policy case_updates_insert on case_updates for insert to authenticated
  with check (
    author_id = auth.uid() and
    exists (
      select 1 from cases c
      where c.id = case_updates.case_id
        and c.deleted_at is null
        and (
          is_owner()
          or has_permission('cases.update.all')
          or (has_permission('cases.update.own') and c.assigned_to = auth.uid())
        )
    )
  );

-- =========================================================================
-- ACTIVITY LOG TRIGGERS on new tables
-- =========================================================================
create or replace function log_activity()
returns trigger language plpgsql as $$
declare
  action_text text;
  entity_text text := tg_argv[0];
  summary_text text;
  metadata_json jsonb;
begin
  if tg_op = 'INSERT' then
    action_text := 'created';
    summary_text := entity_text || ' created';
    metadata_json := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    action_text := 'updated';
    if entity_text = 'case' and old.status is distinct from new.status then
      action_text := 'status_changed';
      summary_text := 'status: ' || old.status || ' → ' || new.status;
    else
      summary_text := entity_text || ' updated';
    end if;
    metadata_json := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    action_text := 'deleted';
    summary_text := entity_text || ' deleted';
    metadata_json := to_jsonb(old);
  end if;

  insert into activity_log (actor_id, action, entity_type, entity_id, summary, metadata)
  values (
    auth.uid(),
    action_text,
    entity_text,
    coalesce(new.id, old.id),
    summary_text,
    metadata_json
  );

  return coalesce(new, old);
end $$;

create trigger clients_activity   after insert or update or delete on clients   for each row execute function log_activity('client');
create trigger companies_activity after insert or update or delete on companies for each row execute function log_activity('company');
create trigger partners_activity  after insert or update or delete on partners  for each row execute function log_activity('partner');
create trigger cases_activity     after insert or update or delete on cases     for each row execute function log_activity('case');
create trigger case_updates_activity after insert on case_updates for each row execute function log_activity('case_update');
