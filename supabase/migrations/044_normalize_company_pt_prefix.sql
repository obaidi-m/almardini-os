-- Normalize every historical PT name to the canonical "PT <trading name>"
-- shape used by the ensurePtPrefix helper on the write path.
--
-- Rules mirror the code:
--   - collapse leading/trailing whitespace and any runs of internal
--     whitespace to a single space
--   - if the name already begins with a "pt" token (case-insensitive,
--     optionally with a period), strip it and re-add the canonical "PT "
--   - otherwise prepend "PT "
--
-- The final UPDATE compares each row against the normalized form and only
-- writes when they actually differ, so re-running this migration on an
-- already-normalized table is a no-op (no useless writes, no updated_at
-- churn).

begin;

with normalized as (
  select
    id,
    'PT ' || regexp_replace(
               regexp_replace(trim(name), '^pt\.?\s+', '', 'i'),
               '\s+', ' ', 'g'
             ) as new_name
    from public.companies
   where name is not null
     and trim(name) <> ''
)
update public.companies c
   set name = n.new_name
  from normalized n
 where c.id = n.id
   and c.name is distinct from n.new_name;

commit;
