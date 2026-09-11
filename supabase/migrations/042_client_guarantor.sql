-- Reverted: guarantor lives per-permit, not per-client.
--
-- Original intent was to attach a PJ (visa sponsor of record) to the client.
-- On reflection that's wrong: a person can hold permits under different
-- sponsors over time, so the PJ belongs on each permit (entity_services)
-- row, not on the client. This migration keeps the number slot but drops
-- anything the earlier version of 042 may have added on dev databases.

begin;

drop index if exists public.clients_guarantor_idx;

alter table public.clients
  drop constraint if exists clients_guarantor_fk;

alter table public.clients
  drop column if exists guarantor_partner_id;

commit;
