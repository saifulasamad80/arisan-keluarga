-- security_invoker perlu membaca kolom filter view, tetapi kolom internal lain
-- pada tabel galeri tetap tidak diberikan kepada anonymous.
grant select (is_published) on public.gallery_photos to anon;