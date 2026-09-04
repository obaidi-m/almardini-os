-- Virtual office rentals are contracts, not work items.
--
-- A VO row is one active tenancy: a company sits at one of our virtual
-- offices from start_date to end_date on a Silver / Gold / Platinum tier.
-- Renewal creates a new row (kept for history); the current-tenancy view
-- filters on status = 'active' + latest end_date per company.
--
-- Distinct from cases (see 005/025): cases move through a work pipeline
-- (new → in_progress → ready → delivered). VOs don't — they exist for a
-- term, then either renew or terminate. The auto-spawn recurring logic
-- on cases is deliberately not reused here.
--
-- RLS mirrors companies: authenticated users read active rows, ops-level
-- roles (owner / clients.create / clients.update) write.

begin;

create table if not exists public.virtual_offices (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  tier          text not null default 'silver'
                  check (tier in ('silver','gold','platinum')),
  term_months   int  not null default 12 check (term_months > 0),
  start_date    date,
  end_date      date not null,
  pic_name      text,
  pic_phone     text,
  status        text not null default 'active'
                  check (status in ('active','expired','terminated')),
  notes         text,
  drive_folder_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  deleted_at    timestamptz
);

create index if not exists virtual_offices_company_idx
  on public.virtual_offices(company_id)
  where deleted_at is null;

create index if not exists virtual_offices_end_date_idx
  on public.virtual_offices(end_date)
  where deleted_at is null and status = 'active';

drop trigger if exists virtual_offices_updated_at on public.virtual_offices;
create trigger virtual_offices_updated_at
  before update on public.virtual_offices
  for each row execute function set_updated_at();

alter table public.virtual_offices enable row level security;

drop policy if exists virtual_offices_read  on public.virtual_offices;
drop policy if exists virtual_offices_write on public.virtual_offices;

create policy virtual_offices_read on public.virtual_offices
  for select to authenticated
  using (deleted_at is null or is_owner());

create policy virtual_offices_write on public.virtual_offices
  for all to authenticated
  using (is_owner() or has_permission('clients.create') or has_permission('clients.update'))
  with check (is_owner() or has_permission('clients.create') or has_permission('clients.update'));

commit;
