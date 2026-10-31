-- 0006: a picture for every post (made in the Design Studio or uploaded).
-- Run this once in the Supabase SQL Editor. Safe to run again.

alter table public.posts
  add column if not exists image_path text
  check (image_path is null or char_length(image_path) <= 300);

-- Private bucket: pictures are only reachable through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A user may only touch files inside the folder named after one of their own workspaces.
drop policy if exists "Owners read their post images"   on storage.objects;
drop policy if exists "Owners upload their post images" on storage.objects;
drop policy if exists "Owners delete their post images" on storage.objects;

create policy "Owners read their post images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] in (
      select w.id::text from public.workspaces w where w.owner_id = (select auth.uid())
    )
  );

create policy "Owners upload their post images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] in (
      select w.id::text from public.workspaces w where w.owner_id = (select auth.uid())
    )
  );

create policy "Owners delete their post images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] in (
      select w.id::text from public.workspaces w where w.owner_id = (select auth.uid())
    )
  );
