-- Adds LinkedIn and Google Business Profile to the platforms a post, message or connected account may have.
-- Run once in the Supabase SQL Editor. Safe to repeat. Requires 0001, 0003 and 0005.

-- Remove the old "only these four platforms" checks (whatever their names), then add the new ones.
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tbl
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.posts'::regclass, 'public.messages'::regclass, 'public.social_accounts'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%tiktok%'
      and pg_get_constraintdef(c.oid) ilike '%youtube%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.posts
  add constraint posts_platforms_check
  check (platforms <@ array['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'gbp']::text[]);

alter table public.messages
  add constraint messages_platform_check
  check (platform in ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'gbp'));

alter table public.social_accounts
  add constraint social_accounts_platform_check
  check (platform in ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'gbp'));
