-- Fix Supabase security advisor warnings by pinning search_path on our functions.
-- Best practice: functions should never rely on the caller's search_path.

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
