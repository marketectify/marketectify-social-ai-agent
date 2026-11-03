-- Facebook + Instagram connection: publishing results and imported comments.
-- Run once in the Supabase SQL Editor. Safe to repeat. Requires 0003, 0005 and 0008.

-- Posts remember when and where they were really published, and why a try failed.
alter table public.posts add column if not exists published_at   timestamptz;
alter table public.posts add column if not exists publish_error  text;
alter table public.posts add column if not exists publish_started_at timestamptz; -- set while a publish is running, so a post is never sent twice
alter table public.posts add column if not exists external_ids   jsonb not null default '{}'::jsonb;

-- Messages imported from a platform keep the platform's own id, so the same comment is never added twice
-- and a reply can be sent to the right comment.
alter table public.messages add column if not exists external_id text;
-- Not a "partial" index on purpose: upsert(onConflict) cannot use those. Messages added by hand have external_id null,
-- and Postgres treats nulls as different from each other, so any number of them is still allowed.
drop index if exists messages_external_unique;
create unique index if not exists messages_external_unique
  on public.messages (workspace_id, platform, external_id);
