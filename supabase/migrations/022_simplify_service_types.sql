-- Drop bilingual duplicates + per-service delivery templates on service_types.
-- The Deliver modal now uses a translated fallback template that the sender
-- edits before sending, so admin-managed per-service templates were extra
-- work with no operational payoff.

alter table service_types drop column if exists name_id;
alter table service_types drop column if exists description_id;
alter table service_types drop column if exists delivery_template_en;
alter table service_types drop column if exists delivery_template_id;
