-- =========================================================================
-- Revoke EXECUTE on internal SECURITY DEFINER functions from public API
-- callers. They still run fine as triggers and inside RLS policies —
-- neither of those paths goes through PostgREST, which is what the
-- Supabase Advisor is warning about.
-- Idempotent — safe to re-run.
-- =========================================================================

do $$
declare
  fn text;
  fns text[] := array[
    -- trigger-only functions (never called via API)
    'set_updated_at()',
    'assign_client_code()',
    'assign_company_code()',
    'assign_partner_code()',
    'assign_case_code()',
    'prevent_case_update_mutation()',
    'log_activity()',
    -- RLS helper functions (only called from inside policies)
    'is_owner()',
    'has_permission(text)',
    'current_role_code()',
    'can_see_delivered()'
  ];
begin
  foreach fn in array fns loop
    execute format('revoke all on function public.%s from public',        fn);
    execute format('revoke all on function public.%s from anon',          fn);
    execute format('revoke all on function public.%s from authenticated', fn);
  end loop;
end $$;
