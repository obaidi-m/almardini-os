-- Feedback — a tiny note-to-self table.
--
-- Any authenticated user can drop a one-liner about what feels wrong or
-- missing while they're using the app. Captured with the URL of the page
-- they were on, so context isn't lost. Owner reviews the list weekly and
-- flips `resolved` when addressed.
--
-- Deliberately simple: no threading, no tags, no severity. If we ever
-- need more, promote to a proper issue tracker.

begin;

create table feedback (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  page_url    text,                          -- window.location.pathname when submitted
  message     text not null check (length(trim(message)) > 0),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index feedback_user_idx      on feedback(user_id);
create index feedback_created_idx   on feedback(created_at desc);
create index feedback_unresolved_idx on feedback(resolved) where resolved = false;

alter table feedback enable row level security;

-- Any authenticated user can insert a row for themselves.
create policy feedback_insert_own on feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- Users can read their own feedback; owner can read all.
create policy feedback_read_own_or_owner on feedback
  for select to authenticated
  using (user_id = auth.uid() or is_owner());

-- Only owner can flip `resolved` / delete.
create policy feedback_update_owner on feedback
  for update to authenticated
  using (is_owner())
  with check (is_owner());

create policy feedback_delete_owner on feedback
  for delete to authenticated
  using (is_owner());

comment on table feedback is
  'Note-to-self box wired into the app; users drop one-liners about friction, owner reviews weekly.';

commit;
