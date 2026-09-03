-- Soft-delete / restore helpers for cases, exposed as security-definer
-- RPCs so the archive button works even when the cases_update WITH CHECK
-- rejects the update for reasons that are hard to reproduce from the app
-- side (stale session state, evaluator quirks, non-owner accidentally
-- passing the outer read gate, etc).
--
-- Both functions gate on either is_owner() or the caller having the
-- corresponding standard permission — the same policy the direct-update
-- path would have applied on a good day. Running as SECURITY DEFINER
-- means the row-level checks on cases don't stop us; the function's
-- own IF gate is the authority.

begin;

create or replace function public.soft_delete_case(target_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_owner() or public.has_permission('cases.delete')) then
    raise exception 'not allowed to archive cases';
  end if;
  update public.cases
     set deleted_at = now(),
         updated_by = auth.uid()
   where id = target_case_id
     and deleted_at is null;
end $$;

create or replace function public.restore_case(target_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_owner() or public.has_permission('cases.delete')) then
    raise exception 'not allowed to restore cases';
  end if;
  update public.cases
     set deleted_at = null,
         updated_by = auth.uid()
   where id = target_case_id
     and deleted_at is not null;
end $$;

-- Lock down default grants; only authenticated users may call.
revoke all on function public.soft_delete_case(uuid) from public, anon;
revoke all on function public.restore_case(uuid)     from public, anon;
grant execute on function public.soft_delete_case(uuid) to authenticated;
grant execute on function public.restore_case(uuid)     to authenticated;

commit;
