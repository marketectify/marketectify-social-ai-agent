-- 0008: pictures (and later videos) that go with a post.
-- Run once in Supabase SQL Editor. Safe to run again. Needs 0001 first.

alter table public.posts add column if not exists media_url  text;
alter table public.posts add column if not exists media_kind text;

alter table public.posts drop constraint if exists posts_media_kind_check;
alter table public.posts
  add constraint posts_media_kind_check check (media_kind is null or media_kind in ('image', 'video'));

-- A public bucket: social networks must be able to fetch the file when a post is published.
-- File names are random and sit in a folder named after the workspace.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 67108864,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only the owner of a workspace may add, change or delete files in that workspace's folder.
drop policy if exists "Owners add post media" on storage.objects;
create policy "Owners add post media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] in (
      select w.id::text from public.workspaces w where w.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners change post media" on storage.objects;
create policy "Owners change post media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] in (
      select w.id::text from public.workspaces w where w.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners delete post media" on storage.objects;
create policy "Owners delete post media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] in (
      select w.id::text from public.workspaces w where w.owner_id = (select auth.uid())
    )
  );
