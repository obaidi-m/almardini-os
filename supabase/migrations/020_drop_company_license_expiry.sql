-- Companies don't expire; licenses do. License expiry belongs on the
-- specific case that tracks that license renewal (via cases.expires_at),
-- not on the company row. Drop the misleading column.

alter table companies drop column if exists license_expires_at;
