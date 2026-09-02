-- =========================================================================
-- Almardini Ops — Company-only cases + optional update text
-- =========================================================================
-- Two schema shifts driven by staff-facing simplicity:
--   1) A case may be attached to a company alone (no personal client).
--      Real cases: change of directors, KBLI update, dissolution, LKPM filings.
--   2) Advancing a case status should require ZERO typing. A case_update row
--      that only records a status change is now valid; text is only required
--      when nothing else is happening.
-- =========================================================================

-- -----------------------------------------------------------------------
-- 1. cases: client_id becomes optional, but a case must belong to SOMEONE
-- -----------------------------------------------------------------------
alter table cases alter column client_id drop not null;

alter table cases
  add constraint cases_client_or_company_required
  check (client_id is not null or company_id is not null);

-- -----------------------------------------------------------------------
-- 2. case_updates: text becomes optional, but a row must carry SOMETHING
--    (either a note, or a status change, or both)
-- -----------------------------------------------------------------------
alter table case_updates alter column text drop not null;

alter table case_updates
  add constraint case_updates_text_or_status_required
  check (
    text is not null
    or (status_before is not null and status_after is not null and status_before is distinct from status_after)
  );
