-- =========================================================================
-- Re-pin search_path on every function so Supabase's Security Advisor
-- stays clean. Idempotent — safe to run multiple times.
-- =========================================================================

-- From 001 (already pinned in 004, restated here for completeness) --------
create or replace function set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.code = 'owner'
  );
$$;

create or replace function has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and (r.permissions ? '*' or r.permissions ? perm)
  );
$$;

-- From 005 -----------------------------------------------------------------
create or replace function assign_client_code()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
declare prefix text;
begin
  if new.code is null or new.code = '' then
    select value #>> '{}' into prefix from public.settings where key = 'id_prefix_client';
    new.code := coalesce(prefix,'CLI') || '-' || lpad(nextval('public.client_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create or replace function assign_company_code()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
declare prefix text;
begin
  if new.code is null or new.code = '' then
    select value #>> '{}' into prefix from public.settings where key = 'id_prefix_company';
    new.code := coalesce(prefix,'CMP') || '-' || lpad(nextval('public.company_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create or replace function assign_partner_code()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
declare prefix text;
begin
  if new.code is null or new.code = '' then
    select value #>> '{}' into prefix from public.settings where key = 'id_prefix_partner';
    new.code := coalesce(prefix,'PRT') || '-' || lpad(nextval('public.partner_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create or replace function assign_case_code()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
declare prefix text;
begin
  if new.code is null or new.code = '' then
    select value #>> '{}' into prefix from public.settings where key = 'id_prefix_case';
    new.code := coalesce(prefix,'CAS') || '-' || lpad(nextval('public.case_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create or replace function current_role_code()
returns text language sql stable
security definer
set search_path = ''
as $$
  select r.code from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid()
$$;

create or replace function can_see_delivered()
returns boolean language sql stable
security definer
set search_path = ''
as $$
  select public.current_role_code() in ('owner','ops_lead') or public.is_owner()
$$;

create or replace function prevent_case_update_mutation()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'case_updates are immutable — create a new update instead';
end $$;

create or replace function log_activity()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
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

  insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, metadata)
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
