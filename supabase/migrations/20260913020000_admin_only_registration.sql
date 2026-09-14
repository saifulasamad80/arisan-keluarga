-- Pendaftaran akun pengurus hanya boleh melalui server-side admin function.
-- Jangan pernah menaruh service_role key di frontend.

-- Trigger auth.users tetap membuat profil secara internal untuk user yang
-- dibuat melalui Supabase Auth. Namun browser tidak boleh membuat/mengubah
-- baris profiles secara langsung sebagai jalur pendaftaran alternatif.
drop policy if exists "profiles_insert_own" on public.profiles;
revoke insert on public.profiles from anon, authenticated;

-- app_metadata tidak dapat ditulis oleh user/anon. Guard ini membuat signup
-- publik tetap gagal walaupun pengaturan Auth Dashboard tidak sengaja aktif.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'created_by_admin_web', 'false') <> 'true' then
    raise exception 'Pendaftaran akun hanya dapat dilakukan oleh admin web.';
  end if;

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

create or replace function public.assign_manager_role(
  p_user_id uuid,
  p_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin()
    or p_role is null
    or p_role not in ('admin'::public.app_role, 'treasurer'::public.app_role) then
    raise exception 'Hanya admin web yang boleh mendaftarkan pengurus.';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception 'Profil pengurus belum tersedia.';
  end if;
end;
$$;

revoke all on function public.assign_manager_role(uuid, public.app_role) from public, anon;
grant execute on function public.assign_manager_role(uuid, public.app_role) to authenticated;

-- User biasa hanya boleh mengubah kolom profil yang aman pada barisnya sendiri.
-- Role, status aktif, tipe anggota, tunggakan, dan metadata waktu tidak boleh
-- diubah melalui REST/RPC oleh user biasa. assign_manager_role di atas adalah
-- jalur khusus admin untuk menetapkan role setelah verifikasi auth.uid().
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Pembuatan user Auth dilakukan oleh Edge Function menggunakan service role,
-- setelah function memverifikasi JWT pemanggil dan role admin di server.