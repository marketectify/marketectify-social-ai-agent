-- Daily limit for AI generations (protects your Gemini bill from runaway use).
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once. Requires 0001_init.sql to have been run first.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default ((now() at time zone 'utc')::date),
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

-- RLS on and NO policies: nobody can read or edit this table directly from the browser.
-- It is only changed through the two functions below.
alter table public.ai_usage enable row level security;

-- Counts one use for the signed-in user. Returns is_allowed = false when today's limit is reached.
create or replace function public.consume_ai_quota(p_limit integer)
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
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid limit' using errcode = '22023';
  end if;

  insert into public.ai_usage as u (user_id, day, count)
  values (v_user, v_day, 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into v_used;

  if v_used is null then
    -- The conflict branch did not run, so the limit was already reached.
    select u.count into v_used from public.ai_usage u where u.user_id = v_user and u.day = v_day;
    return query select false, coalesce(v_used, 0);
  else
    return query select true, v_used;
  end if;
end;
$$;

-- Gives one use back, for example when Gemini was down. Never goes below zero.
create or replace function public.release_ai_quota()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.ai_usage u
     set count = greatest(u.count - 1, 0)
   where u.user_id = auth.uid() and u.day = (now() at time zone 'utc')::date;
end;
$$;

revoke all on function public.consume_ai_quota(integer) from public, anon;
revoke all on function public.release_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;
grant execute on function public.release_ai_quota() to authenticated;
