-- Phase 4: private storage for temporary source files and optimized WebP assets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'site-media-inbox',
    'site-media-inbox',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'site-media',
    'site-media',
    false,
    10485760,
    array['image/webp']::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site_media_final_select_owned" on storage.objects;
create policy "site_media_final_select_owned"
on storage.objects for select to authenticated
using (
  bucket_id = 'site-media'
  and exists (
    select 1
    from public.sites
    where sites.id::text = split_part(storage.objects.name, '/', 1)
      and sites.owner_id = (select auth.uid())
  )
);

drop policy if exists "site_media_final_insert_owned" on storage.objects;
create policy "site_media_final_insert_owned"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-media'
  and exists (
    select 1
    from public.sites
    where sites.id::text = split_part(storage.objects.name, '/', 1)
      and sites.owner_id = (select auth.uid())
  )
);

drop policy if exists "site_media_final_delete_owned" on storage.objects;
create policy "site_media_final_delete_owned"
on storage.objects for delete to authenticated
using (
  bucket_id = 'site-media'
  and exists (
    select 1
    from public.sites
    where sites.id::text = split_part(storage.objects.name, '/', 1)
      and sites.owner_id = (select auth.uid())
  )
);

drop policy if exists "site_media_inbox_select_owned" on storage.objects;
create policy "site_media_inbox_select_owned"
on storage.objects for select to authenticated
using (
  bucket_id = 'site-media-inbox'
  and exists (
    select 1
    from public.sites
    where sites.id::text = split_part(storage.objects.name, '/', 1)
      and sites.owner_id = (select auth.uid())
  )
);

drop policy if exists "site_media_inbox_insert_owned" on storage.objects;
create policy "site_media_inbox_insert_owned"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-media-inbox'
  and exists (
    select 1
    from public.sites
    where sites.id::text = split_part(storage.objects.name, '/', 1)
      and sites.owner_id = (select auth.uid())
  )
);

drop policy if exists "site_media_inbox_delete_owned" on storage.objects;
create policy "site_media_inbox_delete_owned"
on storage.objects for delete to authenticated
using (
  bucket_id = 'site-media-inbox'
  and exists (
    select 1
    from public.sites
    where sites.id::text = split_part(storage.objects.name, '/', 1)
      and sites.owner_id = (select auth.uid())
  )
);

-- The bucket policies scope every object to the first path segment (site UUID).
-- Original filenames never appear in storage paths; the app always generates UUIDs.
