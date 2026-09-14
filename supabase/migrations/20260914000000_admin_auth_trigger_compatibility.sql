-- Admin Auth API tidak memasukkan app_metadata kustom ke auth.users sebelum
-- trigger AFTER INSERT berjalan. Karena itu metadata tidak dapat dipakai untuk
-- membedakan createUser dari signup pada trigger database.
--
-- Signup publik wajib dinonaktifkan pada Authentication > Settings > User
-- Signups (Allow new users to sign up = OFF). Jalur aplikasi tetap dilindungi
-- Edge Function admin-create-user yang memverifikasi JWT dan role admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), coalesce(new.email, '')),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
