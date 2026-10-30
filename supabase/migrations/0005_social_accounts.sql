-- Connected social accounts (YouTube first). Run once in the Supabase SQL Editor. Safe to repeat.
-- Requires 0001_init.sql.
--
-- Security: the login tokens in this table are NEVER readable from the browser.
-- The browser may only read the harmless columns (channel name, counts) and delete its own row.
-- Tokens are written and read only by the Edge Functions, which use the service role key.

create table if not exists public.social_accounts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  platform         text not null check (platform in ('facebook', 'instagram', 'tiktok', 'youtube')),
  external_id      text not null,
  display_name     text not null,
  handle           text not null default '',
  avatar_url       text not null default '',
  subscribers      bigint,
  video_count      bigint not null default 0,
  view_count       bigint not null default 0,
  stats_updated_at timestamptz,
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  scopes           text not null default '',
  connected_at     timestamptz not null default now(),
  unique (workspace_id, platform)
);

alter table public.social_accounts enable row level security;

drop policy if exists "Owners read their social accounts" on public.social_accounts;
drop policy if exists "Owners remove their social accounts" on public.social_accounts;

create policy "Owners read their social accounts"
  on public.social_accounts for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = social_accounts.workspace_id and w.owner_id = (select auth.uid())));

create policy "Owners remove their social accounts"
  on public.social_accounts for delete to authenticated
  using (exists (select 1 from public.workspaces w where w.id = social_accounts.workspace_id and w.owner_id = (select auth.uid())));

-- No insert or update policy: only the service role (Edge Functions) can write.
revoke all on table public.social_accounts from anon, authenticated;
grant select (id, workspace_id, platform, external_id, display_name, handle, avatar_url,
              subscribers, video_count, view_count, stats_updated_at, connected_at)
  on public.social_accounts to authenticated;
grant delete on public.social_accounts to authenticated;
