-- Merge the backfill-auto-created "KITAS" catalog row into "Nomad KITAS" (E33G).
--
-- The Step 3 backfill created a generic "KITAS" service because the
-- source permits.kind was just "KITAS" with no code. The team's real
-- catalog already carries a code-qualified "Nomad KITAS" (E33G). We want
-- every subscription that landed on the generic row to point at the
-- proper one, so the generic one becomes deletable.
--
-- Idempotent: if the generic row is already gone, or its subscriptions
-- have already been moved, the migration is a no-op.

begin;

do $$
declare
  target_id uuid;
  source_id uuid;
  moved     int := 0;
begin
  -- Nomad KITAS is uniquely identified by its E33G code.
  select id into target_id
    from public.service_types
    where upper(coalesce(code, '')) = 'E33G'
    limit 1;

  -- The auto-created row has no code and its name is exactly "KITAS"
  -- (the backfill used the source permits.kind verbatim).
  select id into source_id
    from public.service_types
    where code is null
      and name = 'KITAS'
    limit 1;

  if target_id is null then
    raise notice 'Nomad KITAS (E33G) not found — leaving generic KITAS in place.';
    return;
  end if;
  if source_id is null then
    raise notice 'No generic KITAS row found — nothing to merge.';
    return;
  end if;
  if source_id = target_id then
    raise notice 'Source and target are the same row — nothing to do.';
    return;
  end if;

  update public.entity_services
     set service_id = target_id, updated_at = now()
   where service_id = source_id;
  get diagnostics moved = row_count;

  delete from public.service_types where id = source_id;

  raise notice 'Merged % subscription(s) from generic KITAS into Nomad KITAS (E33G) and dropped the generic row.', moved;
end$$;

commit;
