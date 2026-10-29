-- Inbox: customer comments and direct messages, with the reply that was sent.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once. Requires 0001_init.sql.
--
-- Until the Facebook / Instagram / TikTok / YouTube connections exist, messages are added
-- by hand in the Inbox (paste the comment or DM). Later the platform webhooks fill this table.

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  platform      text not null check (platform in ('facebook', 'instagram', 'tiktok', 'youtube')),
  kind          text not null default 'comment' check (kind in ('comment', 'dm')),
  sender_name   text not null check (char_length(sender_name) between 1 and 80),
  sender_handle text not null default '' check (char_length(sender_handle) <= 80),
  body          text not null check (char_length(body) between 1 and 2000),
  status        text not null default 'unread' check (status in ('unread', 'read', 'replied')),
  reply         text check (reply is null or char_length(reply) <= 2000),
  received_at   timestamptz not null default now(),
  replied_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists messages_workspace_received_idx
  on public.messages (workspace_id, received_at desc);

alter table public.messages enable row level security;

drop policy if exists "Owners manage messages in their workspaces" on public.messages;

create policy "Owners manage messages in their workspaces"
  on public.messages for all to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = messages.workspace_id and w.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = messages.workspace_id and w.owner_id = (select auth.uid())
    )
  );
