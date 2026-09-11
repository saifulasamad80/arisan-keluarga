-- Jalankan jika bucket ikt-files belum terlihat di Storage.
-- File ini aman dijalankan lebih dari satu kali.

insert into storage.buckets (id, name, public)
values ('ikt-files', 'ikt-files', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "ikt_files_select_authenticated" on storage.objects;
create policy "ikt_files_select_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'ikt-files');

drop policy if exists "ikt_files_insert_own_folder" on storage.objects;
create policy "ikt_files_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ikt-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "ikt_files_update_own_folder" on storage.objects;
create policy "ikt_files_update_own_folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'ikt-files'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
)
with check (
  bucket_id = 'ikt-files'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "ikt_files_delete_own_folder" on storage.objects;
create policy "ikt_files_delete_own_folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ikt-files'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);