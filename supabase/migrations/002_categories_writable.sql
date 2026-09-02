-- Allow the admin UI to create/edit/delete service categories.
-- Owner-only, same policy as service_types.
-- The base policies from migration 001 are already correct — this migration is
-- kept as a no-op placeholder for the changelog. Nothing needs to run here.

-- Also add a small display column to categories so the admin UI can control ordering later.
alter table service_categories
  add column if not exists description text;
