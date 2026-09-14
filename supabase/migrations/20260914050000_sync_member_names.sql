-- Pulihkan nama anggota yang sebelumnya tersimpan sebagai alamat email.
-- Nama asli diambil dari metadata Auth atau snapshot spreadsheet jika cocok
-- berdasarkan nomor telepon secara unik. Jangan menebak nama dari email.

update public.profiles as profile
set full_name = trim(auth_user.raw_user_meta_data ->> 'full_name')
from auth.users as auth_user
where auth_user.id = profile.id
  and nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), '') is not null
  and char_length(trim(auth_user.raw_user_meta_data ->> 'full_name')) >= 2
  and (
    nullif(trim(profile.full_name), '') is null
    or lower(trim(profile.full_name)) = lower(coalesce(auth_user.email, ''))
  );

-- Data lama boleh memiliki nomor telepon anggota. Hanya gunakan pasangan
-- nomor-nama yang unik agar nomor bersama tidak menyebabkan nama tertukar.
with unique_legacy_names as (
  select
    regexp_replace(phone, '[^0-9]', '', 'g') as phone_key,
    min(trim(member_name)) as member_name
  from public.legacy_contribution_status
  where nullif(trim(phone), '') is not null
    and nullif(trim(member_name), '') is not null
    and nullif(regexp_replace(phone, '[^0-9]', '', 'g'), '') is not null
  group by regexp_replace(phone, '[^0-9]', '', 'g')
  having count(distinct lower(trim(member_name))) = 1
)
update public.profiles as profile
set full_name = legacy.member_name
from unique_legacy_names as legacy, auth.users as auth_user
where regexp_replace(coalesce(profile.phone, ''), '[^0-9]', '', 'g') = legacy.phone_key
  and auth_user.id = profile.id
  and (
    nullif(trim(profile.full_name), '') is null
    or lower(trim(profile.full_name)) = lower(coalesce(auth_user.email, ''))
  );

create or replace function public.sync_profile_name_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_name text;
begin
  metadata_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');

  if metadata_name is not null and char_length(metadata_name) >= 2 then
    update public.profiles
    set full_name = metadata_name
    where id = new.id
      and (
        nullif(trim(full_name), '') is null
        or lower(trim(full_name)) = 'nama belum diatur'
        or lower(trim(full_name)) = lower(coalesce(new.email, ''))
        or lower(trim(full_name)) = lower(coalesce(old.email, ''))
      );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_metadata_updated on auth.users;
create trigger on_auth_user_metadata_updated
after update of raw_user_meta_data, email on auth.users
for each row execute function public.sync_profile_name_from_auth();

revoke all on function public.sync_profile_name_from_auth() from public, anon, authenticated;

-- Jangan menyimpan email sebagai nama jika trigger Auth dipanggil tanpa metadata.
-- Kolom full_name tetap non-null, sehingga gunakan label yang jelas sampai admin
-- mengisi nama sebenarnya.
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
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Nama belum diatur'),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;