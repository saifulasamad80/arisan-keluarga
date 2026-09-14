-- Dukungan migrasi seluruh sheet Google Sheets lama.
-- Jalankan setelah migration 20260911010000_fix_legacy_import_conflict.sql.
-- Importer memakai service role dari terminal/server aman; service role tidak
-- boleh masuk ke frontend atau repository.

alter table public.events
  add column if not exists legacy_source_key text;

create unique index if not exists events_legacy_source_key_idx
  on public.events (legacy_source_key);

create table if not exists public.legacy_contribution_status (
  id uuid primary key default gen_random_uuid(),
  legacy_source_key text not null unique,
  source_period_label text not null default 'Periode ini',
  member_name text not null check (char_length(trim(member_name)) > 0),
  member_type text not null default 'Tidak diketahui',
  payment_status text not null default 'BELUM',
  arrears numeric(14, 2) check (arrears is null or arrears >= 0),
  phone text,
  matched_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists legacy_contribution_status_name_idx
  on public.legacy_contribution_status (member_name);

create table if not exists public.legacy_deceased_people (
  id uuid primary key default gen_random_uuid(),
  legacy_source_key text not null unique,
  full_name text not null check (char_length(trim(full_name)) > 0),
  lineage_label text,
  father_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.legacy_arisan_winners (
  id uuid primary key default gen_random_uuid(),
  legacy_source_key text not null unique,
  period_label text not null,
  winner_name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists legacy_contribution_status_set_updated_at on public.legacy_contribution_status;
create trigger legacy_contribution_status_set_updated_at
before update on public.legacy_contribution_status
for each row execute function public.set_updated_at();

drop trigger if exists legacy_deceased_people_set_updated_at on public.legacy_deceased_people;
create trigger legacy_deceased_people_set_updated_at
before update on public.legacy_deceased_people
for each row execute function public.set_updated_at();

drop trigger if exists legacy_arisan_winners_set_updated_at on public.legacy_arisan_winners;
create trigger legacy_arisan_winners_set_updated_at
before update on public.legacy_arisan_winners
for each row execute function public.set_updated_at();

alter table public.legacy_contribution_status enable row level security;
alter table public.legacy_deceased_people enable row level security;
alter table public.legacy_arisan_winners enable row level security;

drop policy if exists "legacy_contribution_status_select_manager" on public.legacy_contribution_status;
create policy "legacy_contribution_status_select_manager"
on public.legacy_contribution_status for select to authenticated
using (public.is_admin_or_treasurer());

drop policy if exists "legacy_deceased_people_select_public" on public.legacy_deceased_people;
create policy "legacy_deceased_people_select_public"
on public.legacy_deceased_people for select to anon, authenticated
using (true);

drop policy if exists "legacy_arisan_winners_select_public" on public.legacy_arisan_winners;
create policy "legacy_arisan_winners_select_public"
on public.legacy_arisan_winners for select to anon, authenticated
using (true);

drop view if exists public.public_legacy_contribution_status;
create view public.public_legacy_contribution_status
as
select
  id,
  source_period_label,
  member_name,
  member_type,
  payment_status,
  arrears
from public.legacy_contribution_status;

drop view if exists public.public_legacy_deceased_people;
create view public.public_legacy_deceased_people
as
select id, full_name, lineage_label, father_name
from public.legacy_deceased_people;

drop view if exists public.public_legacy_arisan_winners;
create view public.public_legacy_arisan_winners
as
select id, period_label, winner_name, description
from public.legacy_arisan_winners;

grant select on public.public_legacy_contribution_status to anon, authenticated;
grant select on public.public_legacy_deceased_people to anon, authenticated;
grant select on public.public_legacy_arisan_winners to anon, authenticated;
