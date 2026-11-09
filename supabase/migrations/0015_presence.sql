-- Who is online: every signed-in browser tab pings touch_presence() about once a minute.
-- The admin sees online/offline and "last seen" for every account.

create table if not exists public.user_presence (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  last_seen timestamptz not null default now()
);

alter table public.user_presence enable row level security;
-- No policies: nobody reads or writes this table directly. Everything goes through the functions below.

create or replace function public.touch_presence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.user_presence (user_id, last_seen)
  values (auth.uid(), now())
  on conflict (user_id) do update set last_seen = now();
end;
$$;

-- Admin: when each account's owner was last seen.
create or replace function public.admin_account_presence()
returns table (workspace_id uuid, last_seen timestamptz)
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
    select w.id, p.last_seen
    from public.workspaces w
    left join public.user_presence p on p.user_id = w.owner_id
    limit 500;
end;
$$;

revoke all on function public.touch_presence() from public, anon;
revoke all on function public.admin_account_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;
grant execute on function public.admin_account_presence() to authenticated;
