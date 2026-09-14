-- Kunci operasi blueprint lama pada stack baru.
-- Status_Iuran = roster operasional (bukan akun Auth).
-- Mutasi kas/iuran hanya lewat RPC + PIN hash di app_settings.

-- ---------------------------------------------------------------------------
-- Acara: Tuan Rumah & Petugas Doa sebagai kolom tersendiri
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists host_name text,
  add column if not exists prayer_officer text;

update public.events
set host_name = nullif(trim(regexp_replace(title, '^Arisan di\s+', '')), '')
where host_name is null
  and title ~ '^Arisan di\s+';

update public.events
set prayer_officer = nullif(trim(regexp_replace(description, '^Petugas doa:\s*', '', 'i')), '')
where prayer_officer is null
  and description ~* '^Petugas doa:';

drop view if exists public.public_events;
create view public.public_events
with (security_invoker = true)
as
select id, title, description, starts_at, location, map_url, host_name, prayer_officer
from public.events;

grant select on public.public_events to anon, authenticated, service_role;
grant select (host_name, prayer_officer) on public.events to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Roster operasional = Status_Iuran
-- ---------------------------------------------------------------------------
create table if not exists public.arisan_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) > 0),
  member_type text not null check (member_type in ('Arisan', 'Non-Arisan')),
  period_status text not null default 'BELUM' check (period_status in ('LUNAS', 'BELUM')),
  arrears_periods integer not null default 0 check (arrears_periods >= 0),
  phone text,
  profile_id uuid references public.profiles(id) on delete set null,
  legacy_source_key text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists arisan_members_name_key
  on public.arisan_members (lower(trim(full_name)));
create index if not exists arisan_members_status_idx
  on public.arisan_members (period_status, is_active);

drop trigger if exists arisan_members_set_updated_at on public.arisan_members;
create trigger arisan_members_set_updated_at
before update on public.arisan_members
for each row execute function public.set_updated_at();

insert into public.arisan_members (
  full_name,
  member_type,
  period_status,
  arrears_periods,
  phone,
  profile_id,
  legacy_source_key
)
select
  trim(member_name),
  case
    when lower(coalesce(member_type, '')) like '%non%' then 'Non-Arisan'
    else 'Arisan'
  end,
  case
    when upper(trim(coalesce(payment_status, ''))) = 'LUNAS' then 'LUNAS'
    else 'BELUM'
  end,
  greatest(0, coalesce(arrears, 0)::integer),
  nullif(trim(phone), ''),
  matched_profile_id,
  legacy_source_key
from public.legacy_contribution_status
on conflict (legacy_source_key) do nothing;

create table if not exists public.iuran_settlements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.arisan_members(id) on delete restrict,
  period_count integer not null check (period_count > 0),
  member_type text not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  arrears_before integer not null check (arrears_before >= 0),
  arrears_after integer not null check (arrears_after >= 0),
  status text not null default 'active' check (status in ('active', 'reversed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists iuran_settlements_member_idx
  on public.iuran_settlements (member_id, created_at desc);

alter table public.arisan_members enable row level security;
alter table public.iuran_settlements enable row level security;

drop policy if exists "arisan_members_select_authenticated" on public.arisan_members;
create policy "arisan_members_select_authenticated"
on public.arisan_members for select to authenticated
using (true);

drop policy if exists "iuran_settlements_select_manager" on public.iuran_settlements;
create policy "iuran_settlements_select_manager"
on public.iuran_settlements for select to authenticated
using (public.is_admin_or_treasurer());

revoke all on public.arisan_members from public, anon, authenticated;
revoke all on public.iuran_settlements from public, anon, authenticated;
grant all on public.arisan_members to service_role;
grant all on public.iuran_settlements to service_role;
grant select (
  id,
  full_name,
  member_type,
  period_status,
  arrears_periods,
  profile_id,
  is_active,
  created_at,
  updated_at
) on public.arisan_members to authenticated;
grant select on public.iuran_settlements to authenticated;

drop view if exists public.public_arisan_members;
create view public.public_arisan_members
with (security_invoker = true)
as
select id, full_name, member_type, period_status, arrears_periods, is_active, updated_at
from public.arisan_members
where is_active = true;

drop view if exists public.manager_arisan_members;
create view public.manager_arisan_members
with (security_invoker = false)
as
select id, full_name, member_type, period_status, arrears_periods, phone, is_active, profile_id, updated_at
from public.arisan_members
where is_active = true
  and public.is_admin_or_treasurer();

drop view if exists public.public_iuran_settlements;
create view public.public_iuran_settlements
with (security_invoker = true)
as
select
  s.id,
  s.member_id,
  m.full_name as member_name,
  s.period_count,
  s.member_type,
  s.total_amount,
  s.arrears_before,
  s.arrears_after,
  s.status,
  s.created_at
from public.iuran_settlements s
join public.arisan_members m on m.id = s.member_id;

grant select on public.public_arisan_members to authenticated, service_role;
grant select on public.manager_arisan_members to authenticated, service_role;
grant select on public.public_iuran_settlements to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- PIN helper. Hash tidak pernah keluar dari fungsi.
-- ---------------------------------------------------------------------------
create or replace function public.verify_treasurer_pin(p_pin text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_pin_hash text;
begin
  select setting_value into v_pin_hash
  from public.app_settings
  where setting_key = 'treasurer_pin_hash';

  return v_pin_hash is not null
    and p_pin is not null
    and p_pin ~ '^[0-9]{4}$'
    and crypt(p_pin, v_pin_hash) = v_pin_hash;
end;
$$;

revoke all on function public.verify_treasurer_pin(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- setLunas: pecah dana, LUNAS, potong tunggakan max(0, lama - n)
-- ---------------------------------------------------------------------------
create or replace function public.settle_member_iuran(
  p_member_id uuid,
  p_period_count integer,
  p_pin text
)
returns table (success boolean, message text, settlement_id uuid, total_amount numeric)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.arisan_members%rowtype;
  v_is_arisan boolean;
  v_total numeric(14, 2);
  v_arrears_after integer;
  v_settlement_id uuid := gen_random_uuid();
  v_n integer;
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'SET_LUNAS', false, jsonb_build_object('reason', 'unauthorized', 'member_id', p_member_id));
    return query select false, 'Anda tidak memiliki izin untuk mencatat pelunasan.', null::uuid, null::numeric;
    return;
  end if;

  if not public.verify_treasurer_pin(p_pin) then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'SET_LUNAS', false, jsonb_build_object('reason', 'invalid_pin', 'member_id', p_member_id, 'pin_valid', false));
    return query select false, 'PIN Bendahara Salah!', null::uuid, null::numeric;
    return;
  end if;

  v_n := coalesce(p_period_count, 1);
  if v_n < 1 then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'SET_LUNAS', false, jsonb_build_object('reason', 'invalid_period', 'member_id', p_member_id));
    return query select false, 'Jumlah periode harus berupa bilangan bulat positif.', null::uuid, null::numeric;
    return;
  end if;

  select * into v_member
  from public.arisan_members
  where id = p_member_id and is_active = true
  for update;

  if v_member.id is null then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'SET_LUNAS', false, jsonb_build_object('reason', 'member_not_found', 'member_id', p_member_id));
    return query select false, 'Anggota aktif tidak ditemukan.', null::uuid, null::numeric;
    return;
  end if;

  if v_member.period_status = 'LUNAS' then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'SET_LUNAS', false, jsonb_build_object('reason', 'already_paid', 'member_id', p_member_id));
    return query select false, 'Anggota tersebut sudah berstatus LUNAS untuk periode ini.', null::uuid, null::numeric;
    return;
  end if;

  v_is_arisan := not lower(v_member.member_type) like '%non%';
  v_total := (case when v_is_arisan then 240000 else 100000 end) * v_n;
  v_arrears_after := greatest(0, v_member.arrears_periods - v_n);

  if v_is_arisan then
    insert into public.cash_transactions (type, description, amount, category, notes, created_by, settlement_id)
    values ('income', 'Iuran Arisan ' || v_member.full_name || ' (' || v_n || 'x)', 140000 * v_n, 'Iuran Arisan', 'SET_LUNAS ' || v_settlement_id, v_actor, v_settlement_id);
  end if;

  insert into public.cash_transactions (type, description, amount, category, notes, created_by, settlement_id)
  values
    ('income', 'Iuran Wajib ' || v_member.full_name || ' (' || v_n || 'x)', 20000 * v_n, 'Iuran Wajib', 'SET_LUNAS ' || v_settlement_id, v_actor, v_settlement_id),
    ('income', 'Dana Sosial ' || v_member.full_name || ' (' || v_n || 'x)', 20000 * v_n, 'Dana Sosial', 'SET_LUNAS ' || v_settlement_id, v_actor, v_settlement_id),
    ('income', 'Iuran Konsumsi ' || v_member.full_name || ' (' || v_n || 'x)', 30000 * v_n, 'Konsumsi', 'SET_LUNAS ' || v_settlement_id, v_actor, v_settlement_id),
    ('income', 'Tabungan Kaos ' || v_member.full_name || ' (' || v_n || 'x)', 30000 * v_n, 'Tabungan Kaos', 'SET_LUNAS ' || v_settlement_id, v_actor, v_settlement_id);

  update public.arisan_members
  set period_status = 'LUNAS', arrears_periods = v_arrears_after
  where id = v_member.id;

  insert into public.iuran_settlements (
    id, member_id, period_count, member_type, total_amount, arrears_before, arrears_after, created_by
  ) values (
    v_settlement_id, v_member.id, v_n, v_member.member_type, v_total, v_member.arrears_periods, v_arrears_after, v_actor
  );

  insert into public.audit_log(actor_id, action, success, details)
  values (
    v_actor,
    'SET_LUNAS',
    true,
    jsonb_build_object(
      'settlement_id', v_settlement_id,
      'member_id', v_member.id,
      'nama', v_member.full_name,
      'period_count', v_n,
      'total_amount', v_total,
      'pin_valid', true
    )
  );

  return query select true, 'Lunas ' || v_member.full_name || ' dicatat!', v_settlement_id, v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- batalLunas: BELUM, kembalikan tunggakan, satu pengeluaran Koreksi/Pembatalan
-- ---------------------------------------------------------------------------
create or replace function public.reverse_member_iuran(
  p_member_id uuid,
  p_pin text
)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.arisan_members%rowtype;
  v_settlement public.iuran_settlements%rowtype;
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'BATAL_LUNAS', false, jsonb_build_object('reason', 'unauthorized', 'member_id', p_member_id));
    return query select false, 'Anda tidak memiliki izin untuk membatalkan pelunasan.';
    return;
  end if;

  if not public.verify_treasurer_pin(p_pin) then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'BATAL_LUNAS', false, jsonb_build_object('reason', 'invalid_pin', 'member_id', p_member_id, 'pin_valid', false));
    return query select false, 'PIN Bendahara Salah!';
    return;
  end if;

  select * into v_member
  from public.arisan_members
  where id = p_member_id and is_active = true
  for update;

  if v_member.id is null then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'BATAL_LUNAS', false, jsonb_build_object('reason', 'member_not_found', 'member_id', p_member_id));
    return query select false, 'Anggota aktif tidak ditemukan.';
    return;
  end if;

  select * into v_settlement
  from public.iuran_settlements
  where member_id = p_member_id and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if v_settlement.id is null then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'BATAL_LUNAS', false, jsonb_build_object('reason', 'settlement_not_active', 'member_id', p_member_id));
    return query select false, 'Tidak ada pelunasan aktif yang dapat dibatalkan.';
    return;
  end if;

  insert into public.cash_transactions (type, description, amount, category, notes, created_by, settlement_id)
  values (
    'expense',
    'Batal Lunas ' || v_member.full_name || ' (' || v_settlement.period_count || 'x)',
    v_settlement.total_amount,
    'Koreksi/Pembatalan',
    'BATAL_LUNAS ' || v_settlement.id,
    v_actor,
    v_settlement.id
  );

  update public.arisan_members
  set period_status = 'BELUM', arrears_periods = v_settlement.arrears_before
  where id = v_member.id;

  update public.iuran_settlements
  set status = 'reversed', reversed_at = timezone('utc', now()), reversed_by = v_actor
  where id = v_settlement.id;

  insert into public.audit_log(actor_id, action, success, details)
  values (
    v_actor,
    'BATAL_LUNAS',
    true,
    jsonb_build_object(
      'settlement_id', v_settlement.id,
      'member_id', v_member.id,
      'nama', v_member.full_name,
      'period_count', v_settlement.period_count,
      'total_amount', v_settlement.total_amount,
      'pin_valid', true
    )
  );

  return query select true, 'Koreksi berhasil!';
end;
$$;

-- ---------------------------------------------------------------------------
-- eksekusiAcara: all | arisan | konsumsi
-- ---------------------------------------------------------------------------
create or replace function public.execute_arisan_event(
  p_mode text,
  p_pin text
)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text := lower(trim(coalesce(p_mode, '')));
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'EKSEKUSI_ACARA', false, jsonb_build_object('reason', 'unauthorized', 'mode', v_mode));
    return query select false, 'Anda tidak memiliki izin untuk mengeksekusi acara.';
    return;
  end if;

  if not public.verify_treasurer_pin(p_pin) then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'EKSEKUSI_ACARA', false, jsonb_build_object('reason', 'invalid_pin', 'mode', v_mode, 'pin_valid', false));
    return query select false, 'PIN Bendahara Salah!';
    return;
  end if;

  if v_mode not in ('all', 'arisan', 'konsumsi') then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'EKSEKUSI_ACARA', false, jsonb_build_object('reason', 'invalid_mode', 'mode', v_mode));
    return query select false, 'Mode eksekusi acara tidak valid.';
    return;
  end if;

  if v_mode in ('all', 'arisan') then
    insert into public.cash_transactions (type, description, amount, category, notes, created_by)
    values ('expense', 'Penyerahan Arisan (2 Pemenang)', 3220000, 'Iuran Arisan', 'EKSEKUSI_ACARA ' || v_mode, v_actor);
  end if;

  if v_mode in ('all', 'konsumsi') then
    insert into public.cash_transactions (type, description, amount, category, notes, created_by)
    values ('expense', 'Konsumsi Tuan Rumah', 900000, 'Konsumsi', 'EKSEKUSI_ACARA ' || v_mode, v_actor);
  end if;

  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'EKSEKUSI_ACARA', true, jsonb_build_object('mode', v_mode, 'pin_valid', true));

  if v_mode = 'all' then
    return query select true, 'Acara tereksekusi!';
  elsif v_mode = 'arisan' then
    return query select true, 'Penyerahan arisan Rp 3.220.000 dicatat.';
  else
    return query select true, 'Konsumsi tuan rumah Rp 900.000 dicatat.';
  end if;
end;
$$;

-- Pos dana pengeluaran manual dikunci ke daftar blueprint.
create or replace function public.create_expense(
  p_description text,
  p_amount numeric,
  p_category text,
  p_pin text
)
returns table (success boolean, message text, transaction_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction_id uuid;
  v_category text := trim(coalesce(p_category, ''));
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'PENGELUARAN_MANUAL', false, jsonb_build_object('reason', 'unauthorized'));
    return query select false, 'Anda tidak memiliki izin untuk mencatat pengeluaran.', null::uuid;
    return;
  end if;

  if not public.verify_treasurer_pin(p_pin) then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'PENGELUARAN_MANUAL', false, jsonb_build_object('reason', 'invalid_pin', 'pin_valid', false));
    return query select false, 'PIN Bendahara Salah!', null::uuid;
    return;
  end if;

  if p_description is null or char_length(trim(p_description)) < 3 or p_amount is null or p_amount <= 0 then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'PENGELUARAN_MANUAL', false, jsonb_build_object('reason', 'invalid_input'));
    return query select false, 'Data pengeluaran tidak valid.', null::uuid;
    return;
  end if;

  if v_category not in ('Iuran Arisan', 'Iuran Wajib', 'Dana Sosial', 'Konsumsi', 'Tabungan Kaos', 'Koreksi/Pembatalan') then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'PENGELUARAN_MANUAL', false, jsonb_build_object('reason', 'invalid_pos', 'category', v_category));
    return query select false, 'Pos dana tidak termasuk daftar yang dikunci.', null::uuid;
    return;
  end if;

  insert into public.cash_transactions (type, description, amount, category, created_by)
  values ('expense', trim(p_description), p_amount, v_category, v_actor)
  returning id into v_transaction_id;

  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'PENGELUARAN_MANUAL', true, jsonb_build_object('transaction_id', v_transaction_id, 'amount', p_amount, 'pos_dana', v_category, 'pin_valid', true));

  return query select true, 'Pengeluaran dicatat!', v_transaction_id;
end;
$$;

grant execute on function public.settle_member_iuran(uuid, integer, text) to authenticated;
grant execute on function public.reverse_member_iuran(uuid, text) to authenticated;
grant execute on function public.execute_arisan_event(text, text) to authenticated;
grant execute on function public.create_expense(text, numeric, text, text) to authenticated;
