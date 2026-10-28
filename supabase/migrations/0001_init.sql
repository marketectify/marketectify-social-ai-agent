-- Marketectify AI Social Agent: initial database setup.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- (Or with the Supabase CLI: `supabase db push`.)
--
-- What it creates
--   workspaces : one per account (your agency / brand). A workspace is created
--                automatically when someone signs up.
--   posts      : the content calendar.
--
-- Security: row level security (RLS) is ON for every table. A signed-in user can
-- only ever see and change rows that belong to their own workspace, even though
-- the browser talks to the database directly.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  caption      text not null default '' check (char_length(caption) <= 5000),
  hashtags     text[] not null default '{}',
  platforms    text[] not null default '{}'
               check (platforms <@ array['facebook', 'instagram', 'tiktok', 'youtube']::text[]),
  status       text not null default 'draft'
               check (status in ('draft', 'pending', 'approved', 'published')),
  scheduled_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists posts_workspace_schedule_idx on public.posts (workspace_id, scheduled_at);

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.posts      enable row level security;

drop policy if exists "Owners can read their workspaces"   on public.workspaces;
drop policy if exists "Owners can create their workspaces" on public.workspaces;
drop policy if exists "Owners can update their workspaces" on public.workspaces;
drop policy if exists "Owners can delete their workspaces" on public.workspaces;

create policy "Owners can read their workspaces"
  on public.workspaces for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owners can create their workspaces"
  on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners can update their workspaces"
  on public.workspaces for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can delete their workspaces"
  on public.workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Owners manage posts in their workspaces" on public.posts;

create policy "Owners manage posts in their workspaces"
  on public.posts for all to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = posts.workspace_id and w.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = posts.workspace_id and w.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Create a workspace automatically when a user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspaces (owner_id, name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'workspace_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'My workspace'
      ),
      80
    )
  );
  return new;
end;
$$;

-- This function is only meant to run from the trigger below, never to be called directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
