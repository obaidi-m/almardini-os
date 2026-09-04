-- Permits: KITAS / ITAS / IMTA / business licenses / work permits / etc.
--
-- Same conceptual shape as virtual_offices: one row per issued document
-- with a fixed validity window. Renew = insert a fresh row (old one stays
-- as history). Status auto-flips to expired on read when expires_date
-- passes (see src/lib/permits.ts).
--
-- Belongs to a person (client). May optionally reference a sponsoring
-- company (the PT the KITAS is issued under). Kind is free text so we
-- don't have to migrate every time a new document type comes up — the
-- form seeds a dropdown of common values.
--
-- RLS mirrors clients (a permit is essentially a client artefact).

begin;

create table if not exists public.permits (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references public.clients(id) on delete cascade,
  kind                    text not null,
  reference_no            text,
  issued_date             date,
  expires_date            date not null,
  status                  text not null default 'active'
                            check (status in ('active','expired','terminated')),
  sponsor_company_id      uuid references public.companies(id),
  responsible_partner_id  uuid references public.partners(id),
  notes                   text,
  drive_folder_url        text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id),
  updated_by              uuid references auth.users(id),
  deleted_at              timestamptz
);

create index if not exists permits_client_idx
  on public.permits(client_id)
  where deleted_at is null;

create index if not exists permits_expires_idx
  on public.permits(expires_date)
  where deleted_at is null and status = 'active';

create index if not exists permits_sponsor_idx
  on public.permits(sponsor_company_id)
  where deleted_at is null and sponsor_company_id is not null;

drop trigger if exists permits_updated_at on public.permits;
create trigger permits_updated_at
  before update on public.permits
  for each row execute function set_updated_at();

alter table public.permits enable row level security;

drop policy if exists permits_read  on public.permits;
drop policy if exists permits_write on public.permits;

create policy permits_read on public.permits
  for select to authenticated
  using (deleted_at is null or is_owner());

create policy permits_write on public.permits
  for all to authenticated
  using (is_owner() or has_permission('clients.create') or has_permission('clients.update'))
  with check (is_owner() or has_permission('clients.create') or has_permission('clients.update'));

commit;
