-- =========================================================================
-- Almardini Ops — Initial schema
-- Phase 0 + Admin v1: users, roles, service catalog, activity log
-- =========================================================================

-- Reusable helpers -------------------------------------------------------
create extension if not exists "pgcrypto";

-- Trigger to auto-update `updated_at`
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =========================================================================
-- ROLES
-- =========================================================================
create table roles (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,           -- 'owner', 'ops_lead', 'pro', ...
  name         text not null,                  -- 'Owner', 'Ops Lead', 'PRO', ...
  description  text,
  permissions  jsonb not null default '[]'::jsonb, -- ['clients.read','clients.write',...]
  is_system    boolean not null default false, -- true = cannot be deleted (owner, admin)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger roles_updated before update on roles
  for each row execute function set_updated_at();

-- Seed the canonical roles.
-- Permission codes match src/lib/permissions.ts so the admin UI ticks the right boxes.
insert into roles (code, name, description, permissions, is_system) values
  ('owner', 'Owner', 'Full system access including admin config',
    '["*"]'::jsonb, true),

  ('ops_lead', 'Ops Lead', 'All clients, cases, and finances; can invite users',
    '["clients.read","clients.create","clients.update","clients.delete",
      "cases.read.all","cases.create","cases.update.all","cases.delete",
      "documents.read","documents.upload","documents.delete",
      "payments.read","payments.record","payments.invoice","payments.delete",
      "referrers.read","referrers.create","referrers.update","referrers.delete",
      "reports.view","reports.finance",
      "users.invite","users.update"]'::jsonb, true),

  ('senior_pro', 'Senior PRO', 'All active cases; can advance any case',
    '["clients.read",
      "cases.read.all","cases.create","cases.update.all",
      "documents.read","documents.upload","documents.delete"]'::jsonb, false),

  ('pro', 'PRO', 'Only cases assigned to them',
    '["clients.read",
      "cases.read.own","cases.update.own",
      "documents.read","documents.upload"]'::jsonb, false),

  ('accountant', 'Accountant', 'Payments, commissions, and invoices',
    '["clients.read",
      "cases.read.all",
      "payments.read","payments.record","payments.invoice",
      "referrers.read",
      "reports.view","reports.finance"]'::jsonb, false),

  ('client_success', 'Client Success', 'Client-facing; no financial data',
    '["clients.read","clients.create","clients.update",
      "cases.read.all",
      "documents.read","documents.upload"]'::jsonb, false);

-- =========================================================================
-- USERS  (linked to Supabase Auth's auth.users)
-- =========================================================================
create table users (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null unique,
  full_name     text not null,
  role_id       uuid not null references roles(id),
  phone         text,
  is_active     boolean not null default true,
  invited_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index users_role_idx on users(role_id);
create index users_active_idx on users(is_active);

create trigger users_updated before update on users
  for each row execute function set_updated_at();

-- =========================================================================
-- SERVICE CATALOG
-- Admin-editable list of what Almardini sells: KITAS types, PT PMA, etc.
-- =========================================================================
create table service_categories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,       -- 'immigration', 'company', 'tax'
  name        text not null,              -- 'Immigration', 'Company formation', 'Tax'
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into service_categories (code, name, sort_order) values
  ('immigration', 'Immigration',    10),
  ('company',     'Company formation', 20),
  ('tax',         'Tax & reporting', 30),
  ('other',       'Other services',   99);

create table service_types (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,           -- 'E28A', 'BKPM-NIB', 'E33G'
  name           text not null,                  -- 'Investor KITAS'
  category_id    uuid not null references service_categories(id),
  price          bigint not null default 0,      -- IDR, as integer (no cents)
  currency       text not null default 'IDR',
  duration       text,                           -- '2 years', '6 months'
  description    text,
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index service_types_category_idx on service_types(category_id);
create index service_types_active_idx on service_types(is_active);

create trigger service_types_updated before update on service_types
  for each row execute function set_updated_at();

-- =========================================================================
-- ACTIVITY LOG
-- Every write to a business-critical table emits an event here.
-- =========================================================================
create table activity_log (
  id           bigserial primary key,
  actor_id     uuid references users(id),
  action       text not null,              -- 'created','updated','deleted','invited','role_changed'
  entity_type  text not null,              -- 'user','service_type','role', later 'client','case',...
  entity_id    uuid,
  summary      text,                       -- human-readable one-liner
  metadata     jsonb,                      -- before/after diff or extra context
  created_at   timestamptz not null default now()
);

create index activity_actor_idx on activity_log(actor_id);
create index activity_entity_idx on activity_log(entity_type, entity_id);
create index activity_created_idx on activity_log(created_at desc);

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
alter table roles          enable row level security;
alter table users          enable row level security;
alter table service_categories enable row level security;
alter table service_types  enable row level security;
alter table activity_log   enable row level security;

-- Helper: is the calling user an owner?
create or replace function is_owner()
returns boolean language sql stable as $$
  select exists (
    select 1
    from users u
    join roles r on r.id = u.role_id
    where u.id = auth.uid() and r.code = 'owner'
  );
$$;

-- Helper: does the user have a permission (or the wildcard '*')?
create or replace function has_permission(perm text)
returns boolean language sql stable as $$
  select exists (
    select 1
    from users u
    join roles r on r.id = u.role_id
    where u.id = auth.uid()
      and (
        r.permissions ? '*' or
        r.permissions ? perm
      )
  );
$$;

-- Roles: readable by any authenticated user, writable only by owner
create policy roles_read  on roles for select to authenticated using (true);
create policy roles_write on roles for all    to authenticated using (is_owner()) with check (is_owner());

-- Users: everyone reads (for @mentions etc.), only owner + ops_lead can write
create policy users_read  on users for select to authenticated using (true);
create policy users_write on users for all    to authenticated
  using (is_owner() or has_permission('users.invite'))
  with check (is_owner() or has_permission('users.invite'));

-- Service catalog: any authenticated user reads; only owner writes
create policy service_cat_read  on service_categories for select to authenticated using (true);
create policy service_cat_write on service_categories for all    to authenticated using (is_owner()) with check (is_owner());
create policy service_types_read  on service_types for select to authenticated using (true);
create policy service_types_write on service_types for all    to authenticated using (is_owner()) with check (is_owner());

-- Activity log: everyone in the office can read; only the system inserts
create policy activity_read on activity_log for select to authenticated using (true);
