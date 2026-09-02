-- Collapse the case status pipeline from 5 states to 4.
-- Ready was never used distinctly from Done in practice: work finishes internally
-- (Done), then staff hands it to the client via WhatsApp/email (Delivered).
-- Any existing rows in `ready` roll into `done`.

begin;

update public.cases set status = 'done' where status = 'ready';

-- case_updates has an immutability trigger; disable it only for this
-- one-time historical fixup, then re-enable.
alter table public.case_updates disable trigger user;

-- Delete first: rows that would become no-op transitions after the rewrite
-- (done↔ready, ready→ready) and carry no text of their own. The check
-- constraint `text_or_status_required` is evaluated per-row during UPDATE,
-- so these must be gone before we touch the status columns.
delete from public.case_updates
 where text is null
   and (
        (status_before = 'ready' and status_after = 'done')
     or (status_before = 'done'  and status_after = 'ready')
     or (status_before = 'ready' and status_after = 'ready')
   );

update public.case_updates set status_before = 'done' where status_before = 'ready';
update public.case_updates set status_after  = 'done' where status_after  = 'ready';

alter table public.case_updates enable trigger user;

alter table public.cases
  drop constraint if exists cases_status_check;
alter table public.cases
  add constraint cases_status_check
  check (status in ('new','in_progress','done','delivered'));

alter table public.case_updates
  drop constraint if exists case_updates_status_before_check;
alter table public.case_updates
  add constraint case_updates_status_before_check
  check (status_before in ('new','in_progress','done','delivered'));

alter table public.case_updates
  drop constraint if exists case_updates_status_after_check;
alter table public.case_updates
  add constraint case_updates_status_after_check
  check (status_after in ('new','in_progress','done','delivered'));

commit;
