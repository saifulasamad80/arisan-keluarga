-- Pelunasan iuran atomik, pembagian pos, pembatalan berbasis koreksi, dan audit.
-- PIN hanya diperiksa di server melalui app_settings; jangan menaruh PIN di frontend.

alter table public.profiles
  add column if not exists member_type text not null default 'non-arisan',
  add column if not exists arrears_periods integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_arrears_periods_check;
alter table public.profiles
  add constraint profiles_arrears_periods_check check (arrears_periods >= 0);

alter table public.contributions
  add column if not exists period_count integer not null default 1,
  add column if not exists member_type text not null default 'non-arisan',
  add column if not exists settlement_id uuid;

alter table public.contributions
  drop constraint if exists contributions_period_count_check;
alter table public.contributions
  add constraint contributions_period_count_check check (period_count > 0);

alter table public.cash_transactions
  add column if not exists settlement_id uuid,
  add column if not exists reversal_of_id uuid references public.cash_transactions(id) on delete restrict;

create table if not exists public.contribution_settlements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete restrict,
  contribution_id uuid not null unique references public.contributions(id) on delete restrict,
  period_count integer not null check (period_count > 0),
  member_type text not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  arrears_before integer not null check (arrears_before >= 0),
  arrears_after integer not null check (arrears_after >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'reversed')),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  success boolean not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index if not exists contribution_settlements_member_idx
  on public.contribution_settlements (member_id, created_at desc);
create index if not exists cash_transactions_settlement_idx
  on public.cash_transactions (settlement_id);
create index if not exists audit_log_occurred_at_idx
  on public.audit_log (occurred_at desc);

-- Migration sengaja tidak memasang PIN default. PIN yang diketahui publik akan
-- membuat pemeriksaan kedua ini tidak berguna. Konfigurasikan hash PIN melalui
-- SQL Editor atau secret deployment sebelum fitur mutasi keuangan digunakan.

alter table public.contribution_settlements enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "settlements_select_manager" on public.contribution_settlements;
create policy "settlements_select_manager"
on public.contribution_settlements for select to authenticated
using (public.is_admin_or_treasurer());

drop policy if exists "audit_log_select_manager" on public.audit_log;
create policy "audit_log_select_manager"
on public.audit_log for select to authenticated
using (public.is_admin_or_treasurer());

revoke all on public.app_settings from anon, authenticated;
revoke all on public.audit_log from anon;
grant select on public.contribution_settlements to authenticated;
grant select on public.audit_log to authenticated;

drop view if exists public.public_members;
create view public.public_members
as
select id, full_name, avatar_url, role, member_type, is_active, joined_at, updated_at
from public.profiles
where is_active = true;

drop view if exists public.public_contributions;
create view public.public_contributions
as
select
  c.id,
  c.member_id,
  p.full_name as member_name,
  c.period_start,
  c.period_end,
  c.period_count,
  c.member_type,
  c.amount,
  c.status,
  c.paid_at
from public.contributions c
join public.profiles p on p.id = c.member_id
where p.is_active = true;

grant select on public.public_members to anon, authenticated;
grant select on public.public_contributions to anon, authenticated;

drop view if exists public.manager_members;
create view public.manager_members
with (security_invoker = true)
as
select id, full_name, phone, avatar_url, role, member_type, is_active, joined_at, created_at, updated_at
from public.profiles
where is_active = true
  and public.is_admin_or_treasurer();

grant select on public.manager_members to authenticated;

create or replace function public.settle_contribution(
  p_member_id uuid,
  p_period_start date,
  p_period_end date,
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
  v_member_type text;
  v_arrears_before integer;
  v_arrears_after integer;
  v_unit_amount numeric(14, 2);
  v_total_amount numeric(14, 2);
  v_contribution_id uuid;
  v_settlement_id uuid := gen_random_uuid();
  v_pin_hash text;
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'settle_contribution', false, jsonb_build_object('reason', 'unauthorized'));
    return query select false, 'Anda tidak memiliki izin untuk mencatat pelunasan.', null::uuid, null::numeric;
    return;
  end if;

  select setting_value into v_pin_hash
  from public.app_settings
  where setting_key = 'treasurer_pin_hash';

  if v_pin_hash is null or p_pin is null or p_pin !~ '^[0-9]{4}$' or crypt(p_pin, v_pin_hash) <> v_pin_hash then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'settle_contribution', false, jsonb_build_object('reason', 'invalid_pin', 'member_id', p_member_id));
    return query select false, 'PIN bendahara salah.', null::uuid, null::numeric;
    return;
  end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start or p_period_count is null or p_period_count < 1 then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'settle_contribution', false, jsonb_build_object('reason', 'invalid_period', 'member_id', p_member_id));
    return query select false, 'Periode pelunasan tidak valid.', null::uuid, null::numeric;
    return;
  end if;

  select member_type, arrears_periods
    into v_member_type, v_arrears_before
  from public.profiles
  where id = p_member_id and is_active = true
  for update;

  if v_member_type is null then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'settle_contribution', false, jsonb_build_object('reason', 'member_not_found', 'member_id', p_member_id));
    return query select false, 'Anggota aktif tidak ditemukan.', null::uuid, null::numeric;
    return;
  end if;

  if lower(v_member_type) like '%arisan%' and lower(v_member_type) not like '%non%' then
    v_unit_amount := 240000;
  else
    v_unit_amount := 100000;
    v_member_type := 'non-arisan';
  end if;

  if exists (
    select 1
    from public.contributions
    where member_id = p_member_id
      and status = 'paid'
      and period_start <= p_period_end
      and period_end >= p_period_start
  ) then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'settle_contribution', false, jsonb_build_object('reason', 'overlapping_period', 'member_id', p_member_id));
    return query select false, 'Periode tersebut sudah memiliki pembayaran aktif.', null::uuid, null::numeric;
    return;
  end if;

  v_total_amount := v_unit_amount * p_period_count;
  v_arrears_after := greatest(0, v_arrears_before - p_period_count);

  insert into public.contributions (member_id, period_start, period_end, period_count, member_type, amount, status, paid_at, recorded_by, settlement_id)
  values (p_member_id, p_period_start, p_period_end, p_period_count, v_member_type, v_total_amount, 'paid', timezone('utc', now()), v_actor, v_settlement_id)
  returning id into v_contribution_id;

  if v_member_type = 'arisan' then
    insert into public.cash_transactions (type, description, amount, category, notes, created_by, settlement_id)
    values ('income', 'Pelunasan iuran - Arisan', 140000 * p_period_count, 'Iuran Arisan', 'Settlement ' || v_settlement_id, v_actor, v_settlement_id);
  end if;
  insert into public.cash_transactions (type, description, amount, category, notes, created_by, settlement_id)
  values
    ('income', 'Pelunasan iuran - Wajib', 20000 * p_period_count, 'Iuran Wajib', 'Settlement ' || v_settlement_id, v_actor, v_settlement_id),
    ('income', 'Pelunasan iuran - Sosial', 20000 * p_period_count, 'Dana Sosial', 'Settlement ' || v_settlement_id, v_actor, v_settlement_id),
    ('income', 'Pelunasan iuran - Konsumsi', 30000 * p_period_count, 'Uang Konsumsi', 'Settlement ' || v_settlement_id, v_actor, v_settlement_id),
    ('income', 'Pelunasan iuran - Kaos', 30000 * p_period_count, 'Tabungan Kaos', 'Settlement ' || v_settlement_id, v_actor, v_settlement_id);

  update public.profiles set arrears_periods = v_arrears_after where id = p_member_id;
  insert into public.contribution_settlements (id, member_id, contribution_id, period_count, member_type, total_amount, arrears_before, arrears_after, created_by)
  values (v_settlement_id, p_member_id, v_contribution_id, p_period_count, v_member_type, v_total_amount, v_arrears_before, v_arrears_after, v_actor);
  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'settle_contribution', true, jsonb_build_object('settlement_id', v_settlement_id, 'member_id', p_member_id, 'period_count', p_period_count, 'total_amount', v_total_amount));

  return query select true, 'Pelunasan berhasil dicatat.', v_settlement_id, v_total_amount;
end;
$$;

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
  v_pin_hash text;
  v_transaction_id uuid;
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'create_expense', false, jsonb_build_object('reason', 'unauthorized'));
    return query select false, 'Anda tidak memiliki izin untuk mencatat pengeluaran.', null::uuid;
    return;
  end if;

  select setting_value into v_pin_hash from public.app_settings where setting_key = 'treasurer_pin_hash';
  if v_pin_hash is null or p_pin is null or p_pin !~ '^[0-9]{4}$' or crypt(p_pin, v_pin_hash) <> v_pin_hash then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'create_expense', false, jsonb_build_object('reason', 'invalid_pin'));
    return query select false, 'PIN bendahara salah.', null::uuid;
    return;
  end if;

  if p_description is null or char_length(trim(p_description)) < 3 or p_amount is null or p_amount <= 0 or p_category is null or char_length(trim(p_category)) = 0 then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'create_expense', false, jsonb_build_object('reason', 'invalid_input'));
    return query select false, 'Data pengeluaran tidak valid.', null::uuid;
    return;
  end if;

  insert into public.cash_transactions (type, description, amount, category, created_by)
  values ('expense', trim(p_description), p_amount, trim(p_category), v_actor)
  returning id into v_transaction_id;
  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'create_expense', true, jsonb_build_object('transaction_id', v_transaction_id, 'amount', p_amount, 'category', p_category));
  return query select true, 'Pengeluaran berhasil dicatat.', v_transaction_id;
end;
$$;

-- Semua mutasi kas/iuran dari browser wajib melalui RPC yang memeriksa PIN.
drop policy if exists "cash_transactions_insert_treasurer" on public.cash_transactions;
drop policy if exists "cash_transactions_update_treasurer" on public.cash_transactions;
drop policy if exists "cash_transactions_delete_treasurer" on public.cash_transactions;
drop policy if exists "contributions_insert_treasurer" on public.contributions;
drop policy if exists "contributions_update_treasurer" on public.contributions;
drop policy if exists "contributions_delete_treasurer" on public.contributions;

create or replace function public.reverse_contribution_settlement(p_settlement_id uuid, p_pin text)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_settlement public.contribution_settlements%rowtype;
  v_pin_hash text;
  v_transaction public.cash_transactions%rowtype;
begin
  if v_actor is null or not public.is_admin_or_treasurer() then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'reverse_contribution_settlement', false, jsonb_build_object('reason', 'unauthorized', 'settlement_id', p_settlement_id));
    return query select false, 'Anda tidak memiliki izin untuk membatalkan pelunasan.';
    return;
  end if;
  select setting_value into v_pin_hash from public.app_settings where setting_key = 'treasurer_pin_hash';
  if v_pin_hash is null or p_pin is null or p_pin !~ '^[0-9]{4}$' or crypt(p_pin, v_pin_hash) <> v_pin_hash then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'reverse_contribution_settlement', false, jsonb_build_object('reason', 'invalid_pin', 'settlement_id', p_settlement_id));
    return query select false, 'PIN bendahara salah.';
    return;
  end if;
  select * into v_settlement from public.contribution_settlements where id = p_settlement_id for update;
  if v_settlement.id is null or v_settlement.status <> 'active' then
    insert into public.audit_log(actor_id, action, success, details)
    values (v_actor, 'reverse_contribution_settlement', false, jsonb_build_object('reason', 'settlement_not_active', 'settlement_id', p_settlement_id));
    return query select false, 'Pelunasan tidak ditemukan atau sudah dibatalkan.';
    return;
  end if;

  for v_transaction in select * from public.cash_transactions where settlement_id = p_settlement_id loop
    insert into public.cash_transactions (type, description, amount, category, notes, created_by, settlement_id, reversal_of_id)
    values ('expense', 'Koreksi pembatalan - ' || v_transaction.description, v_transaction.amount, v_transaction.category, 'Pembalikan settlement ' || p_settlement_id, v_actor, p_settlement_id, v_transaction.id);
  end loop;
  update public.contributions set status = 'void', notes = coalesce(notes || E'\n', '') || 'Dibatalkan melalui koreksi settlement ' || p_settlement_id where id = v_settlement.contribution_id;
  update public.profiles set arrears_periods = v_settlement.arrears_before where id = v_settlement.member_id;
  update public.contribution_settlements set status = 'reversed', reversed_at = timezone('utc', now()), reversed_by = v_actor where id = p_settlement_id;
  insert into public.audit_log(actor_id, action, success, details)
  values (v_actor, 'reverse_contribution_settlement', true, jsonb_build_object('settlement_id', p_settlement_id));
  return query select true, 'Pelunasan dibatalkan dan koreksi kas dicatat.';
end;
$$;

grant execute on function public.settle_contribution(uuid, date, date, integer, text) to authenticated;
grant execute on function public.create_expense(text, numeric, text, text) to authenticated;
grant execute on function public.reverse_contribution_settlement(uuid, text) to authenticated;
