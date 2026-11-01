-- 0007: separate daily limit for AI pictures (and later videos). They cost real money per
-- item, so they get their own small counter instead of sharing the text limit.
-- Run once in Supabase SQL Editor. Safe to run again. Needs 0001 first.

create table if not exists public.media_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default ((now() at time zone 'utc')::date),
  kind    text not null check (kind in ('image', 'video')),
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

-- RLS on and no policies: only the functions below can change it.
alter table public.media_usage enable row level security;

create or replace function public.consume_media_quota(p_kind text, p_limit integer)
returns table (is_allowed boolean, used_today integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day  date := (now() at time zone 'utc')::date;
  v_used integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('image', 'video') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid limit' using errcode = '22023';
  end if;

  insert into public.media_usage as u (user_id, day, kind, count)
  values (v_user, v_day, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into v_used;

  if v_used is null then
    select u.count into v_used from public.media_usage u
     where u.user_id = v_user and u.day = v_day and u.kind = p_kind;
    return query select false, coalesce(v_used, 0);
  else
    return query select true, v_used;
  end if;
end;
$$;

create or replace function public.release_media_quota(p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.media_usage u
     set count = greatest(u.count - 1, 0)
   where u.user_id = auth.uid() and u.kind = p_kind and u.day = (now() at time zone 'utc')::date;
end;
$$;

revoke all on function public.consume_media_quota(text, integer) from public, anon;
revoke all on function public.release_media_quota(text) from public, anon;
grant execute on function public.consume_media_quota(text, integer) to authenticated;
grant execute on function public.release_media_quota(text) to authenticated;
