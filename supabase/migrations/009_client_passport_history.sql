-- =========================================================================
-- Passport history for clients.
--
-- When a client renews their passport, staff just update the passport_no /
-- passport_expires_at fields on the client. A trigger archives the OLD
-- values into client_passports so the historical passport is never lost.
-- =========================================================================

create table client_passports (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients(id) on delete cascade,
  passport_no        text not null,
  passport_expires_at date,
  archived_at        timestamptz not null default now(),   -- when it stopped being current
  archived_by        uuid references users(id),
  note               text,                                 -- optional: "renewed at embassy", etc.
  created_at         timestamptz not null default now()
);

create index client_passports_client_idx
  on client_passports(client_id, archived_at desc);

create index client_passports_number_idx
  on client_passports(lower(passport_no));

-- -------------------------------------------------------------------------
-- Trigger: archive old passport whenever passport_no changes
-- -------------------------------------------------------------------------
create or replace function archive_previous_passport()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only archive if the passport number actually changed
  -- (ignore case where it was NULL and is now being set for the first time)
  if old.passport_no is distinct from new.passport_no
     and old.passport_no is not null
     and old.passport_no <> '' then
    insert into public.client_passports (
      client_id, passport_no, passport_expires_at, archived_by
    ) values (
      old.id, old.passport_no, old.passport_expires_at, auth.uid()
    );
  end if;
  return new;
end $$;

create trigger clients_archive_passport
  before update of passport_no on clients
  for each row execute function archive_previous_passport();

-- Lock down the archive function from public API calls
revoke all on function public.archive_previous_passport() from public;
revoke all on function public.archive_previous_passport() from anon;
revoke all on function public.archive_previous_passport() from authenticated;

-- -------------------------------------------------------------------------
-- RLS: read follows client visibility; no direct writes from clients
-- (writes only via the trigger, which runs as security definer)
-- -------------------------------------------------------------------------
alter table client_passports enable row level security;

create policy client_passports_read on client_passports for select to authenticated using (
  exists (
    select 1 from clients c
    where c.id = client_passports.client_id
      and (c.deleted_at is null or is_owner())
  )
);

-- No insert/update/delete policies → clients cannot write directly.
-- The trigger runs as security definer and bypasses RLS.
