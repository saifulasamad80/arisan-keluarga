-- Akses baca publik untuk anggota yang tidak menggunakan login.
-- Operasi tulis tetap hanya tersedia melalui policy authenticated.

alter table public.events add column if not exists map_url text;

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 3),
  caption text,
  image_url text not null,
  taken_on date,
  is_published boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists gallery_photos_taken_on_idx
  on public.gallery_photos (taken_on desc, created_at desc);

drop trigger if exists gallery_photos_set_updated_at on public.gallery_photos;
create trigger gallery_photos_set_updated_at
before update on public.gallery_photos
for each row execute function public.set_updated_at();

alter table public.gallery_photos enable row level security;

drop policy if exists "gallery_photos_select_published" on public.gallery_photos;
create policy "gallery_photos_select_published"
on public.gallery_photos for select to anon, authenticated
using (is_published = true);

drop policy if exists "gallery_photos_insert_manager" on public.gallery_photos;
create policy "gallery_photos_insert_manager"
on public.gallery_photos for insert to authenticated
with check (public.is_admin_or_treasurer() and created_by = auth.uid());

drop policy if exists "gallery_photos_update_manager" on public.gallery_photos;
create policy "gallery_photos_update_manager"
on public.gallery_photos for update to authenticated
using (public.is_admin_or_treasurer())
with check (public.is_admin_or_treasurer());

drop policy if exists "gallery_photos_delete_manager" on public.gallery_photos;
create policy "gallery_photos_delete_manager"
on public.gallery_photos for delete to authenticated
using (public.is_admin_or_treasurer());

-- Bucket foto galeri memang publik karena gambar yang sudah diterbitkan
-- harus dapat dibaca anggota tanpa login. Upload tetap dibatasi policy.
insert into storage.buckets (id, name, public)
values ('ikt-gallery', 'ikt-gallery', true)
on conflict (id) do update set name = excluded.name, public = excluded.public;

drop policy if exists "ikt_gallery_select_public" on storage.objects;
create policy "ikt_gallery_select_public"
on storage.objects for select to anon, authenticated
using (bucket_id = 'ikt-gallery');

drop policy if exists "ikt_gallery_insert_manager_folder" on storage.objects;
create policy "ikt_gallery_insert_manager_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ikt-gallery'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_admin_or_treasurer()
);

drop policy if exists "ikt_gallery_update_manager_folder" on storage.objects;
create policy "ikt_gallery_update_manager_folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'ikt-gallery'
  and public.is_admin_or_treasurer()
)
with check (
  bucket_id = 'ikt-gallery'
  and public.is_admin_or_treasurer()
);

drop policy if exists "ikt_gallery_delete_manager_folder" on storage.objects;
create policy "ikt_gallery_delete_manager_folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ikt-gallery'
  and public.is_admin_or_treasurer()
);

-- View publik tidak membocorkan pembuat, catatan internal, atau metadata sensitif.
-- View sengaja bukan security_invoker: policy baca tabel lama adalah authenticated,
-- sedangkan view ini mengekspos hanya kolom yang memang diperuntukkan bagi publik.
drop view if exists public.public_cash_transactions;
create view public.public_cash_transactions
as
select id, type, description, amount, category, occurred_on, created_at, updated_at
from public.cash_transactions;

drop view if exists public.public_contributions;
create view public.public_contributions
as
select
  c.id,
  c.member_id,
  p.full_name as member_name,
  c.period_start,
  c.period_end,
  c.amount,
  c.status,
  c.paid_at
from public.contributions c
join public.profiles p on p.id = c.member_id
where p.is_active = true;

drop view if exists public.public_events;
create view public.public_events
as
select id, title, description, starts_at, location, map_url
from public.events;

drop view if exists public.public_members;
create view public.public_members
as
select id, full_name, avatar_url, role, is_active, joined_at, updated_at
from public.profiles
where is_active = true;

drop view if exists public.public_prayer_notes;
create view public.public_prayer_notes
as
select id, title, body, is_pinned, created_at, updated_at
from public.prayer_notes;

drop view if exists public.public_gallery_photos;
create view public.public_gallery_photos
as
select id, title, caption, image_url, taken_on, created_at
from public.gallery_photos
where is_published = true;

grant select on public.public_cash_transactions to anon, authenticated;
grant select on public.public_contributions to anon, authenticated;
grant select on public.public_events to anon, authenticated;
grant select on public.public_members to anon, authenticated;
grant select on public.public_prayer_notes to anon, authenticated;
grant select on public.public_gallery_photos to anon, authenticated;

-- Nomor kontak hanya dapat dibaca oleh admin/bendahara untuk pengingat.
drop view if exists public.manager_members;
create view public.manager_members
as
select id, full_name, phone, avatar_url, role, is_active, joined_at, created_at, updated_at
from public.profiles
where is_active = true
  and public.is_admin_or_treasurer();

grant select on public.manager_members to authenticated;