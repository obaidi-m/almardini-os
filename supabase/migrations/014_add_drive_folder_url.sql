-- =========================================================================
-- Add a `drive_folder_url` link on clients, companies, and cases.
--
-- Files live in OneDrive; the app just holds a shared-link URL pointing
-- at each entity's folder. One-click "Open in OneDrive" on the detail
-- page. No file bytes flow through Supabase / the app.
-- =========================================================================

alter table clients   add column drive_folder_url text;
alter table companies add column drive_folder_url text;
alter table cases     add column drive_folder_url text;
