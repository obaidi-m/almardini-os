-- Let owners see archived cases through the normal SELECT path so the
-- "Show archived" toggle on /cases can actually surface them. Without
-- this, the cases_read policy blanket-hides any row with deleted_at set,
-- even from the owner — the same reason /clients and /companies already
-- have an `or is_owner()` escape hatch on their read policies.
--
-- Non-owner behaviour is unchanged: everyone else still only sees rows
-- where deleted_at is null, and delivered visibility is still gated by
-- can_see_delivered() as before.

begin;

drop policy if exists cases_read on public.cases;

create policy cases_read on public.cases for select to authenticated using (
  public.is_owner()
  or (
    deleted_at is null
    and (
      public.can_see_delivered()
      or (
        status <> 'delivered'
        and (
          public.has_permission('cases.read.all')
          or (public.has_permission('cases.read.own') and assigned_to = auth.uid())
        )
      )
    )
  )
);

commit;
