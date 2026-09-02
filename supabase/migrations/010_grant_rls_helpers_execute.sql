-- =========================================================================
-- Re-grant EXECUTE on RLS helper functions to `authenticated`.
--
-- Migration 007 revoked EXECUTE from these functions on the assumption that
-- SECURITY DEFINER meant RLS policies could still call them without the
-- caller holding EXECUTE. That's not how Postgres works: EXECUTE is checked
-- against the caller regardless of SECURITY DEFINER, including from inside
-- an RLS policy. The revoke broke every policy that references them
-- (clients, companies, partners, cases, case_updates), surfacing as
-- "permission denied for function is_owner" when reading any of those
-- tables through PostgREST.
--
-- Trigger-only functions (assign_*_code, set_updated_at, log_activity,
-- prevent_case_update_mutation) stay revoked — they're never called via
-- the API, only fired by triggers, which run as the table owner.
-- =========================================================================

grant execute on function public.is_owner()            to authenticated;
grant execute on function public.has_permission(text)  to authenticated;
grant execute on function public.current_role_code()   to authenticated;
grant execute on function public.can_see_delivered()   to authenticated;
