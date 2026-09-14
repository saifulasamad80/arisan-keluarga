-- Nomor telepon bukan data profil umum. Jangan berikan privilege kolom ini pada
-- authenticated karena anggota biasa dapat memanggil tabel profiles langsung.
revoke select (phone) on public.profiles from anon, authenticated;

-- manager_members adalah satu-satunya jalur aplikasi untuk kontak pengurus.
-- Filter role tetap diperiksa oleh view menggunakan auth.uid().
alter view public.manager_members set (security_invoker = false);
revoke all on public.manager_members from public, anon, authenticated;
grant select on public.manager_members to authenticated;