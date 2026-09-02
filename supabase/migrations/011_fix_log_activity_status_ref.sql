-- =========================================================================
-- Fix: log_activity() references old.status / new.status unconditionally,
-- which PL/pgSQL resolves against the row type of whatever table fires the
-- trigger — including clients / companies / partners, which have no status
-- column. Updating any non-case row raises:
--   record "old" has no field "status"
--
-- Fix by reading status via jsonb so the field name is looked up at
-- runtime instead of prepared as a column reference at plan time.
-- =========================================================================

create or replace function log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_text  text;
  entity_text  text := tg_argv[0];
  summary_text text;
  metadata_json jsonb;
  old_status   text;
  new_status   text;
begin
  if tg_op = 'INSERT' then
    action_text := 'created';
    summary_text := entity_text || ' created';
    metadata_json := to_jsonb(new);

  elsif tg_op = 'UPDATE' then
    action_text := 'updated';
    if entity_text = 'case' then
      old_status := to_jsonb(old) ->> 'status';
      new_status := to_jsonb(new) ->> 'status';
      if old_status is distinct from new_status then
        action_text := 'status_changed';
        summary_text := 'status: ' || coalesce(old_status,'∅') || ' → ' || coalesce(new_status,'∅');
      else
        summary_text := entity_text || ' updated';
      end if;
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

revoke all on function public.log_activity() from public;
revoke all on function public.log_activity() from anon;
revoke all on function public.log_activity() from authenticated;
