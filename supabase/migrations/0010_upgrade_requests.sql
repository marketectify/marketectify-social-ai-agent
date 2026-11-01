-- 0010: upgrade requests and the admin screen.
-- Run once in Supabase SQL Editor. Safe to run again. Needs 0001 and 0009 first.
--
-- How it works:
--   * A customer on the Free plan sends an upgrade request from the website.
--   * You (an admin) see the request on the Admin screen and press Approve or Reject.
--     Approve switches their workspace to the pro plan.
--   * Who is an admin is decided ONLY here, in the SQL Editor (see docs/SETUP.md, "Plans").
-- Nobody can change a plan or an admin from the browser directly: the tables have no write policies.

create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- No policies on purpose: the browser cannot read or change this table.

create table if not exists public.upgrade_requests (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan         text not null default 'pro' check (plan = 'pro'),
  contact      text not null check (char_length(contact) between 3 and 120),
  note         text not null default '' check (char_length(note) <= 500),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users (id) on delete set null
);

create index if not exists upgrade_requests_status_idx on public.upgrade_requests (status, created_at desc);
-- Only one open request per workspace.
create unique index if not exists upgrade_requests_one_open_idx
  on public.upgrade_requests (workspace_id) where status = 'pending';

alter table public.upgrade_requests enable row level security;

drop policy if exists "Users read their own upgrade requests" on public.upgrade_requests;
create policy "Users read their own upgrade requests"
  on public.upgrade_requests for select to authenticated
  using (user_id = (select auth.uid()));
-- No insert/update/delete policies: everything goes through the functions below.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

-- A customer asks for the Pro plan.
create or replace function public.request_upgrade(p_contact text, p_note text default '')
returns public.upgrade_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_workspace uuid;
  v_row       public.upgrade_requests;
  v_contact   text := btrim(coalesce(p_contact, ''));
  v_note      text := btrim(coalesce(p_note, ''));
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(v_contact) < 3 or char_length(v_contact) > 120 then
    raise exception 'Please add a phone number, WhatsApp or email we can reach you on.' using errcode = '22023';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'The note is too long (maximum 500 characters).' using errcode = '22023';
  end if;

  select w.id into v_workspace
    from public.workspaces w where w.owner_id = v_user order by w.created_at limit 1;
  if v_workspace is null then
    raise exception 'No workspace found for this account.' using errcode = 'P0002';
  end if;

  if public.my_plan() = 'pro' then
    raise exception 'Your account is already on the Pro plan.' using errcode = '22023';
  end if;
  if exists (select 1 from public.upgrade_requests r where r.workspace_id = v_workspace and r.status = 'pending') then
    raise exception 'You already have an upgrade request waiting. We will contact you soon.' using errcode = '23505';
  end if;

  insert into public.upgrade_requests (workspace_id, user_id, contact, note)
  values (v_workspace, v_user, v_contact, v_note)
  returning * into v_row;
  return v_row;
end;
$$;

-- Admin: all requests, newest first, with who asked.
create or replace function public.admin_list_upgrade_requests()
returns table (
  id uuid, workspace_id uuid, workspace_name text, email text, contact text, note text,
  status text, created_at timestamptz, resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select r.id, r.workspace_id, w.name, u.email::text, r.contact, r.note, r.status, r.created_at, r.resolved_at
    from public.upgrade_requests r
    join public.workspaces w on w.id = r.workspace_id
    left join auth.users u on u.id = r.user_id
    order by (r.status = 'pending') desc, r.created_at desc
    limit 200;
end;
$$;

-- Admin: approve (workspace becomes pro) or reject a pending request.
create or replace function public.admin_resolve_upgrade(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.upgrade_requests;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_req from public.upgrade_requests where id = p_id for update;
  if not found then
    raise exception 'Request not found.' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request was already answered.' using errcode = '22023';
  end if;

  if p_approve then
    insert into public.workspace_plans (workspace_id, plan) values (v_req.workspace_id, 'pro')
    on conflict (workspace_id) do update set plan = 'pro', updated_at = now();
  end if;
  update public.upgrade_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         resolved_at = now(), resolved_by = auth.uid()
   where id = p_id;
end;
$$;

-- Admin: every account with its plan (to see who is Pro, or to move someone back to Free).
create or replace function public.admin_list_accounts()
returns table (workspace_id uuid, workspace_name text, email text, plan text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select w.id, w.name, u.email::text, coalesce(p.plan, 'free'), w.created_at
    from public.workspaces w
    left join public.workspace_plans p on p.workspace_id = w.id
    left join auth.users u on u.id = w.owner_id
    order by w.created_at desc
    limit 500;
end;
$$;

create or replace function public.admin_set_plan(p_workspace uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_plan not in ('free', 'pro') then
    raise exception 'invalid plan' using errcode = '22023';
  end if;
  insert into public.workspace_plans (workspace_id, plan) values (p_workspace, p_plan)
  on conflict (workspace_id) do update set plan = excluded.plan, updated_at = now();
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.request_upgrade(text, text) from public, anon;
revoke all on function public.admin_list_upgrade_requests() from public, anon;
revoke all on function public.admin_resolve_upgrade(uuid, boolean) from public, anon;
revoke all on function public.admin_list_accounts() from public, anon;
revoke all on function public.admin_set_plan(uuid, text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.request_upgrade(text, text) to authenticated;
grant execute on function public.admin_list_upgrade_requests() to authenticated;
grant execute on function public.admin_resolve_upgrade(uuid, boolean) to authenticated;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;
