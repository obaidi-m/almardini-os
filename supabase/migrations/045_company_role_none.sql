-- =========================================================================
-- Add a "None" position so a person can be linked to a company without a
-- specific role. Uses sort_order 0 so it sorts first and becomes the
-- default option in the UI.
-- =========================================================================

insert into company_roles (code, label_en, label_id, sort_order) values
  ('none', 'None', 'Tidak Ada', 0)
on conflict (code) do nothing;
