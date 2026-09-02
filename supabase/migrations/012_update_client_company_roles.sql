-- =========================================================================
-- Replace client_companies.role enum values with the four real positions
-- Almardini deals with on Indonesian PT PMA structures:
--   director              (Direktur)
--   director_general      (Direktur Utama)
--   commissioner          (Komisaris)
--   general_commissioner  (Komisaris Utama)
--
-- Any rows created before this migration (using owner/shareholder/other)
-- are mapped to sensible new values so the constraint doesn't reject them.
-- =========================================================================

-- 1. Drop the old check constraint (inline, auto-named).
alter table client_companies
  drop constraint if exists client_companies_role_check;

-- 2. Migrate existing rows onto the new vocabulary.
--    owner       → director_general  (majority-owner in a PMA is typically Direktur Utama)
--    shareholder → commissioner       (non-executive stake ≈ Komisaris)
--    other       → commissioner       (safest catch-all; edit manually if wrong)
update client_companies set role = 'director_general' where role = 'owner';
update client_companies set role = 'commissioner'     where role in ('shareholder', 'other');

-- 3. Add the new check constraint.
alter table client_companies
  add constraint client_companies_role_check
  check (role in ('director', 'director_general', 'commissioner', 'general_commissioner'));
