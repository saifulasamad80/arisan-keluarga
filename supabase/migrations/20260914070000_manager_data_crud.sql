-- CRUD pengurus untuk data operasional setelah migrasi sheet lama.
-- Kas ber-settlement dan Set Lunas tetap hanya lewat RPC ber-PIN.
-- Roster arisan_members tidak mendapat GRANT DML; tulis hanya lewat RPC.

-- ---------------------------------------------------------------------------
-- Nama aktif unik, supaya anggota yang dinonaktifkan bisa didaftarkan ulang
-- ---------------------------------------------------------------------------
drop index if exists public.arisan_members_name_key;
create unique index if not exists arisan_members_active_name_key
  on public.arisan_members (lower(trim(full_name)))
  where is_active = true;

-- ---------------------------------------------------------------------------
-- Tandai baris kas yang terkunci karena pelunasan/koreksi
-- ---------------------------------------------------------------------------
drop view if exists public.public_cash_transactions;
create view public.public_cash_transactions
with (security_invoker = true)
as
select
  id,
  type,
  description,
  amount,
  category,
  occurred_on,
  created_at,
  updated_at,
  (settlement_id is not null) as is_locked
from public.cash_transactions;

grant select on public.public_cash_transactions to authenticated, service_role;
grant all on public.public_cash_transactions to service_role;

-- ---------------------------------------------------------------------------
-- Agenda & catatan doa: hanya admin/bendahara
-- ---------------------------------------------------------------------------
drop policy if exists "events_insert_authenticated" on public.events;
drop policy if exists "events_insert_manager" on public.events;
create policy "events_insert_manager"
on public.events for insert to authenticated
with check (public.is_admin_or_treasurer() and created_by = auth.uid());

drop policy if exists "prayer_notes_insert_authenticated" on public.prayer_notes;
drop policy if exists "prayer_notes_insert_manager" on public.prayer_notes;
create policy "prayer_notes_insert_manager"
on public.prayer_notes for insert to authenticated
with check (public.is_admin_or_treasurer() and created_by = auth.uid());

drop policy if exists "prayer_notes_update_owner_or_admin" on public.prayer_notes;
drop policy if exists "prayer_notes_update_manager" on public.prayer_notes;
create policy "prayer_notes_update_manager"
on public.prayer_notes for update to authenticated
using (public.is_admin_or_treasurer())
with check (public.is_admin_or_treasurer());

drop policy if exists "prayer_notes_delete_owner_or_admin" on public.prayer_notes;
drop policy if exists "prayer_notes_delete_manager" on public.prayer_notes;
create policy "prayer_notes_delete_manager"
on public.prayer_notes for delete to authenticated
using (public.is_admin_or_treasurer());

-- ---------------------------------------------------------------------------
-- Almarhum & pemenang: data hidup, bukan arsip baca-saja
-- ---------------------------------------------------------------------------
alter table public.legacy_deceased_people
  alter column legacy_source_key set default ('app:' || gen_random_uuid()::text);
alter table public.legacy_arisan_winners
  alter column legacy_source_key set default ('app:' || gen_random_uuid()::text);

grant insert, update, delete on public.legacy_deceased_people to authenticated;
grant insert, update, delete on public.legacy_arisan_winners to authenticated;

drop policy if exists "legacy_deceased_people_insert_manager" on public.legacy_deceased_people;
create policy "legacy_deceased_people_insert_manager"
on public.legacy_deceased_people for insert to authenticated
with check (public.is_admin_or_treasurer());

drop policy if exists "legacy_deceased_people_update_manager" on public.legacy_deceased_people;
create policy "legacy_deceased_people_update_manager"
on public.legacy_deceased_people for update to authenticated
using (public.is_admin_or_treasurer())
with check (public.is_admin_or_treasurer());

drop policy if exists "legacy_deceased_people_delete_manager" on public.legacy_deceased_people;
create policy "legacy_deceased_people_delete_manager"
on public.legacy_deceased_people for delete to authenticated
using (public.is_admin_or_treasurer());

drop policy if exists "legacy_arisan_winners_insert_manager" on public.legacy_arisan_winners;
create policy "legacy_arisan_winners_insert_manager"
on public.legacy_arisan_winners for insert to authenticated
with check (public.is_admin_or_treasurer());

drop policy if exists "legacy_arisan_winners_update_manager" on public.legacy_arisan_winners;
create policy "legacy_arisan_winners_update_manager"
on public.legacy_arisan_winners for update to authenticated
using (public.is_admin_or_treasurer())
with check (public.is_admin_or_treasurer());

drop policy if exists "legacy_arisan_winners_delete_manager" on public.legacy_arisan_winners;
create policy "legacy_arisan_winners_delete_manager"
on public.legacy_arisan_winners for delete to authenticated
using (public.is_admin_or_treasurer());

-- ---------------------------------------------------------------------------
-- Roster: isi / ubah / hapus tanpa menulis kas
-- ---------------------------------------------------------------------------
create or replace function public.upsert_arisan_member(
  p_id uuid,
  p_full_name text,
  p_member_type text,
  p_period_status text,
  p_arrears_periods integer,
  p_phone text
)
returns table (success boolean, message text, member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := p_id;
  v_name text := trim(coalesce(p_full_name, ''));
  v_type text := trim(coalesce(p_member_type, ''));
  v_status text := upper(trim(coalesce(p_period_status, 'BELUM')));
  v_arrears integer := coalesce(p_arrears_periods, 0);
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_existing public.arisan_members%rowtype;
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'UPSERT_MEMBER', false, jsonb_build_object('reason', 'unauthorized'));
    return query select false, 'Anda tidak memiliki izin untuk mengubah roster anggota.', null::uuid;
    return;
  end if;

  if char_length(v_name) < 2 then
    return query select false, 'Nama anggota minimal 2 karakter.', null::uuid;
    return;
  end if;

  if v_type not in ('Arisan', 'Non-Arisan') then
    return query select false, 'Tipe anggota harus Arisan atau Non-Arisan.', null::uuid;
    return;
  end if;

  if v_status not in ('LUNAS', 'BELUM') then
    return query select false, 'Status periode hanya LUNAS atau BELUM.', null::uuid;
    return;
  end if;

  if v_arrears < 0 then
    return query select false, 'Jumlah tunggakan tidak boleh negatif.', null::uuid;
    return;
  end if;

  if v_id is null then
    select * into v_existing
    from public.arisan_members
    where lower(trim(full_name)) = lower(v_name)
      and is_active = false
    limit 1;

    if v_existing.id is not null then
      v_id := v_existing.id;
    else
      insert into public.arisan_members (
        full_name, member_type, period_status, arrears_periods, phone, is_active
      ) values (
        v_name, v_type, v_status, v_arrears, v_phone, true
      )
      returning id into v_id;

      insert into public.audit_log(actor_id, action, success, details)
      values (v_actor, 'UPSERT_MEMBER', true, jsonb_build_object('member_id', v_id, 'mode', 'insert', 'nama', v_name));
      return query select true, 'Anggota ditambahkan.', v_id;
      return;
    end if;
  else
    select * into v_existing
    from public.arisan_members
    where id = v_id
    for update;

    if v_existing.id is null then
      return query select false, 'Anggota tidak ditemukan.', null::uuid;
      return;
    end if;
  end if;

  update public.arisan_members
  set
    full_name = v_name,
    member_type = v_type,
    period_status = v_status,
    arrears_periods = v_arrears,
    phone = v_phone,
    is_active = true
  where id = v_id;

  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'UPSERT_MEMBER', true, jsonb_build_object('member_id', v_id, 'mode', 'update', 'nama', v_name, 'arrears_periods', v_arrears, 'period_status', v_status));

  return query select true, 'Data anggota disimpan.', v_id;
exception
  when unique_violation then
    return query select false, 'Nama anggota sudah dipakai.', null::uuid;
end;
$$;

create or replace function public.delete_arisan_member(p_id uuid)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.arisan_members%rowtype;
  v_has_settlement boolean;
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'DELETE_MEMBER', false, jsonb_build_object('reason', 'unauthorized', 'member_id', p_id));
    return query select false, 'Anda tidak memiliki izin untuk menghapus anggota.';
    return;
  end if;

  select * into v_member
  from public.arisan_members
  where id = p_id
  for update;

  if v_member.id is null then
    return query select false, 'Anggota tidak ditemukan.';
    return;
  end if;

  select exists(select 1 from public.iuran_settlements where member_id = p_id)
  into v_has_settlement;

  if v_has_settlement then
    update public.arisan_members set is_active = false where id = p_id;
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'DELETE_MEMBER', true, jsonb_build_object('member_id', p_id, 'mode', 'deactivate', 'nama', v_member.full_name));
    return query select true, 'Anggota dinonaktifkan karena masih punya riwayat pelunasan.';
    return;
  end if;

  delete from public.arisan_members where id = p_id;
  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'DELETE_MEMBER', true, jsonb_build_object('member_id', p_id, 'mode', 'delete', 'nama', v_member.full_name));
  return query select true, 'Anggota dihapus.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Kas manual: ubah/hapus ber-PIN, tolak baris hasil Set Lunas / Batal Lunas
-- ---------------------------------------------------------------------------
create or replace function public.update_manual_cash_transaction(
  p_id uuid,
  p_description text,
  p_amount numeric,
  p_category text,
  p_occurred_on date,
  p_pin text
)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.cash_transactions%rowtype;
  v_category text := trim(coalesce(p_category, ''));
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'UPDATE_KAS', false, jsonb_build_object('reason', 'unauthorized', 'transaction_id', p_id));
    return query select false, 'Anda tidak memiliki izin untuk mengubah kas.';
    return;
  end if;

  if not public.verify_treasurer_pin(p_pin) then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'UPDATE_KAS', false, jsonb_build_object('reason', 'invalid_pin', 'transaction_id', p_id, 'pin_valid', false));
    return query select false, 'PIN Bendahara Salah!';
    return;
  end if;

  select * into v_row from public.cash_transactions where id = p_id for update;
  if v_row.id is null then
    return query select false, 'Transaksi tidak ditemukan.';
    return;
  end if;

  if v_row.settlement_id is not null then
    return query select false, 'Transaksi pelunasan terkunci. Gunakan Batal Lunas.';
    return;
  end if;

  if p_description is null or char_length(trim(p_description)) < 3 or p_amount is null or p_amount <= 0 or p_occurred_on is null then
    return query select false, 'Data transaksi tidak valid.';
    return;
  end if;

  if v_category = 'Koreksi/Pembatalan' then
    return query select false, 'Pos Koreksi/Pembatalan hanya dari Batal Lunas.';
    return;
  end if;

  if v_category not in ('Iuran Arisan', 'Iuran Wajib', 'Dana Sosial', 'Konsumsi', 'Tabungan Kaos', 'Lainnya') then
    return query select false, 'Pos dana tidak termasuk daftar yang dikunci.';
    return;
  end if;

  update public.cash_transactions
  set
    description = trim(p_description),
    amount = p_amount,
    category = v_category,
    occurred_on = p_occurred_on
  where id = p_id;

  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'UPDATE_KAS', true, jsonb_build_object('transaction_id', p_id, 'amount', p_amount, 'pos_dana', v_category, 'pin_valid', true));
  return query select true, 'Transaksi diperbarui.';
end;
$$;

create or replace function public.delete_manual_cash_transaction(
  p_id uuid,
  p_pin text
)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.cash_transactions%rowtype;
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'DELETE_KAS', false, jsonb_build_object('reason', 'unauthorized', 'transaction_id', p_id));
    return query select false, 'Anda tidak memiliki izin untuk menghapus kas.';
    return;
  end if;

  if not public.verify_treasurer_pin(p_pin) then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'DELETE_KAS', false, jsonb_build_object('reason', 'invalid_pin', 'transaction_id', p_id, 'pin_valid', false));
    return query select false, 'PIN Bendahara Salah!';
    return;
  end if;

  select * into v_row from public.cash_transactions where id = p_id for update;
  if v_row.id is null then
    return query select false, 'Transaksi tidak ditemukan.';
    return;
  end if;

  if v_row.settlement_id is not null then
    return query select false, 'Transaksi pelunasan terkunci. Gunakan Batal Lunas.';
    return;
  end if;

  delete from public.cash_transactions where id = p_id;
  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'DELETE_KAS', true, jsonb_build_object('transaction_id', p_id, 'amount', v_row.amount, 'pin_valid', true));
  return query select true, 'Transaksi dihapus.';
end;
$$;

revoke all on function public.upsert_arisan_member(uuid, text, text, text, integer, text) from public, anon;
revoke all on function public.delete_arisan_member(uuid) from public, anon;
revoke all on function public.update_manual_cash_transaction(uuid, text, numeric, text, date, text) from public, anon;
revoke all on function public.delete_manual_cash_transaction(uuid, text) from public, anon;

grant execute on function public.upsert_arisan_member(uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.delete_arisan_member(uuid) to authenticated;
grant execute on function public.update_manual_cash_transaction(uuid, text, numeric, text, date, text) to authenticated;
grant execute on function public.delete_manual_cash_transaction(uuid, text) to authenticated;
