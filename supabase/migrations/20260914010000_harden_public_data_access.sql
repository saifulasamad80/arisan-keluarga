-- Perketat akses PostgREST pada tabel dan view yang dibuat oleh migration lama.
-- View publik harus memakai RLS tabel sumber melalui security_invoker; jangan
-- mengandalkan nama view atau penyembunyian kolom sebagai kontrol akses.

-- Hapus privilege bawaan yang terlalu luas. service_role tetap diberi akses
-- eksplisit karena dipakai oleh importer/server-side jobs.
revoke all on public.profiles,
  public.cash_transactions,
  public.contributions,
  public.events,
  public.prayer_notes,
  public.gallery_photos,
  public.legacy_contribution_status,
  public.legacy_deceased_people,
  public.legacy_arisan_winners
from public, anon, authenticated;

grant all on public.profiles,
  public.cash_transactions,
  public.contributions,
  public.events,
  public.prayer_notes,
  public.gallery_photos,
  public.legacy_contribution_status,
  public.legacy_deceased_people,
  public.legacy_arisan_winners
to service_role;

-- Tabel internal: baca hanya untuk sesi login, dan mutasi hanya pada jalur
-- aplikasi yang memang memerlukannya. RPC security definer tetap dapat menulis
-- karena berjalan sebagai pemilik function.
grant select on public.profiles,
  public.cash_transactions,
  public.contributions,
  public.events,
  public.prayer_notes,
  public.gallery_photos,
  public.legacy_contribution_status,
  public.legacy_deceased_people,
  public.legacy_arisan_winners
to authenticated;

grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant insert, update, delete on public.events to authenticated;
grant insert, update, delete on public.prayer_notes to authenticated;
grant insert, update, delete on public.gallery_photos to authenticated;

-- Event, galeri terbit, almarhum, dan pemenang lama memang merupakan konten
-- publik. Tambahkan policy anon hanya pada tabel yang benar-benar publik.
drop policy if exists "events_select_public" on public.events;
create policy "events_select_public"
on public.events for select to anon
using (true);

-- Karena view memakai security_invoker, berikan anon hanya kolom yang dipakai
-- view publik. Ini mencegah akses langsung ke created_by/source_key dan kolom
-- internal lain melalui endpoint tabel sumber.
grant select (id, title, description, starts_at, location, map_url)
on public.events to anon;
grant select (id, title, caption, image_url, taken_on, created_at)
on public.gallery_photos to anon;
grant select (id, full_name, lineage_label, father_name)
on public.legacy_deceased_people to anon;
grant select (id, period_label, winner_name, description)
on public.legacy_arisan_winners to anon;

-- Pastikan view tidak melewati RLS tabel sumber. Ini juga membuat perubahan
-- policy tabel di masa depan tetap berlaku saat view dipanggil PostgREST.
alter view public.public_cash_transactions set (security_invoker = true);
alter view public.public_contributions set (security_invoker = true);
alter view public.public_events set (security_invoker = true);
alter view public.public_gallery_photos set (security_invoker = true);
alter view public.public_legacy_arisan_winners set (security_invoker = true);
alter view public.public_legacy_contribution_status set (security_invoker = true);
alter view public.public_legacy_deceased_people set (security_invoker = true);
alter view public.public_members set (security_invoker = true);
alter view public.public_prayer_notes set (security_invoker = true);

-- View selalu read-only dan tidak mewarisi privilege INSERT/UPDATE/DELETE.
revoke all on public.public_cash_transactions,
  public.public_contributions,
  public.public_events,
  public.public_gallery_photos,
  public.public_legacy_arisan_winners,
  public.public_legacy_contribution_status,
  public.public_legacy_deceased_people,
  public.public_members,
  public.public_prayer_notes
from public, anon, authenticated;

grant select on public.public_events,
  public.public_gallery_photos,
  public.public_legacy_arisan_winners,
  public.public_legacy_deceased_people
to anon, authenticated;

grant select on public.public_cash_transactions,
  public.public_contributions,
  public.public_legacy_contribution_status,
  public.public_members,
  public.public_prayer_notes
to authenticated;

grant all on public.public_cash_transactions,
  public.public_contributions,
  public.public_events,
  public.public_gallery_photos,
  public.public_legacy_arisan_winners,
  public.public_legacy_contribution_status,
  public.public_legacy_deceased_people,
  public.public_members,
  public.public_prayer_notes
to service_role;