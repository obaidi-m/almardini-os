-- =========================================================================
-- Make client_companies.role admin-editable.
--
-- Previously the allowed roles lived in a CHECK constraint on the column,
-- so adding / renaming one meant a code change + migration. Replace that
-- with a small lookup table (`company_roles`) that owners can edit from
-- the admin panel. client_companies.role becomes an FK into it.
--
-- Bilingual labels (EN + ID) are stored per row so the future i18n toggle
-- reads directly from the DB.
-- =========================================================================

create table company_roles (
  code       text primary key,          -- machine value stored in client_companies.role
  label_en   text not null,
  label_id   text,                      -- Indonesian; falls back to label_en if null
  sort_order int  not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_roles_updated before update on company_roles
  for each row execute function set_updated_at();

-- Seed the four current values.
insert into company_roles (code, label_en, label_id, sort_order) values
  ('director',             'Director',             'Direktur',         10),
  ('director_general',     'Director General',     'Direktur Utama',   20),
  ('commissioner',         'Commissioner',         'Komisaris',        30),
  ('general_commissioner', 'General Commissioner', 'Komisaris Utama',  40);

-- Swap the CHECK constraint for a real FK.
alter table client_companies
  drop constraint if exists client_companies_role_check;

alter table client_companies
  add constraint client_companies_role_fk
  foreign key (role) references company_roles(code)
  on update cascade   -- renaming a code carries through
  on delete restrict; -- can't drop a role that's still in use

-- RLS: everyone authenticated reads; only owner writes.
alter table company_roles enable row level security;

create policy company_roles_read  on company_roles for select to authenticated using (true);
create policy company_roles_write on company_roles for all    to authenticated
  using (is_owner()) with check (is_owner());
