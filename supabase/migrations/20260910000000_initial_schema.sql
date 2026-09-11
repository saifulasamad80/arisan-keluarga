-- Arisan IKT - initial schema
-- Jalankan melalui Supabase CLI atau SQL Editor Supabase.
-- Jangan pernah menaruh service_role key di frontend.

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('admin', 'treasurer', 'member');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.cash_transaction_type as enum ('income', 'expense');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.contribution_status as enum ('pending', 'paid', 'void');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  role public.app_role not null default 'member',
  is_active boolean not null default true,
  joined_at date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  type public.cash_transaction_type not null,
  description text not null check (char_length(trim(description)) >= 3),
  amount numeric(14, 2) not null check (amount > 0),
  category text not null default 'Lainnya',
  occurred_on date not null default current_date,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  amount numeric(14, 2) not null check (amount > 0),
  status public.contribution_status not null default 'paid',
  paid_at timestamptz,
  notes text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contributions_valid_period check (period_end >= period_start)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 3),
  description text,
  starts_at timestamptz not null,
  location text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.prayer_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 3),
  body text not null,
  is_pinned boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists cash_transactions_occurred_on_idx
  on public.cash_transactions (occurred_on desc);
create index if not exists cash_transactions_type_idx
  on public.cash_transactions (type);
create index if not exists contributions_member_period_idx
  on public.contributions (member_id, period_start desc);
create index if not exists events_starts_at_idx
  on public.events (starts_at);
create index if not exists prayer_notes_pinned_created_idx
  on public.prayer_notes (is_pinned desc, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'::public.app_role
      and is_active = true
  );
$$;

create or replace function public.is_admin_or_treasurer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin'::public.app_role, 'treasurer'::public.app_role)
      and is_active = true
  );
$$;

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

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    -- Bootstrap admin hanya boleh dilakukan dari SQL Editor/migration context
    -- (auth.uid() null) dan hanya jika belum ada admin sama sekali.
    if auth.uid() is null
      and new.role = 'admin'::public.app_role
      and not exists (
        select 1 from public.profiles
        where role = 'admin'::public.app_role
      ) then
      return new;
    end if;
    raise exception 'Only an admin can change profile roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_role_escalation();

drop trigger if exists cash_transactions_set_updated_at on public.cash_transactions;
create trigger cash_transactions_set_updated_at
before update on public.cash_transactions
for each row execute function public.set_updated_at();

drop trigger if exists contributions_set_updated_at on public.contributions;
create trigger contributions_set_updated_at
before update on public.contributions
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists prayer_notes_set_updated_at on public.prayer_notes;
create trigger prayer_notes_set_updated_at
before update on public.prayer_notes
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill aman untuk user Auth yang dibuat sebelum migration ini.
insert into public.profiles (id, full_name, phone)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), coalesce(email, '')),
  nullif(trim(raw_user_meta_data ->> 'phone'), '')
from auth.users
on conflict (id) do nothing;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_or_treasurer() to authenticated;

alter table public.profiles enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.contributions enable row level security;
alter table public.events enable row level security;
alter table public.prayer_notes enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
on public.profiles for delete to authenticated
using (public.is_admin());

drop policy if exists "cash_transactions_select_authenticated" on public.cash_transactions;
create policy "cash_transactions_select_authenticated"
on public.cash_transactions for select to authenticated
using (true);

drop policy if exists "cash_transactions_insert_treasurer" on public.cash_transactions;
create policy "cash_transactions_insert_treasurer"
on public.cash_transactions for insert to authenticated
with check (public.is_admin_or_treasurer() and created_by = auth.uid());

drop policy if exists "cash_transactions_update_treasurer" on public.cash_transactions;
create policy "cash_transactions_update_treasurer"
on public.cash_transactions for update to authenticated
using (public.is_admin_or_treasurer())
with check (public.is_admin_or_treasurer());

drop policy if exists "cash_transactions_delete_treasurer" on public.cash_transactions;
create policy "cash_transactions_delete_treasurer"
on public.cash_transactions for delete to authenticated
using (public.is_admin_or_treasurer());

drop policy if exists "contributions_select_authenticated" on public.contributions;
create policy "contributions_select_authenticated"
on public.contributions for select to authenticated
using (true);

drop policy if exists "contributions_insert_treasurer" on public.contributions;
create policy "contributions_insert_treasurer"
on public.contributions for insert to authenticated
with check (public.is_admin_or_treasurer() and recorded_by = auth.uid());

drop policy if exists "contributions_update_treasurer" on public.contributions;
create policy "contributions_update_treasurer"
on public.contributions for update to authenticated
using (public.is_admin_or_treasurer())
with check (public.is_admin_or_treasurer());

drop policy if exists "contributions_delete_treasurer" on public.contributions;
create policy "contributions_delete_treasurer"
on public.contributions for delete to authenticated
using (public.is_admin_or_treasurer());

drop policy if exists "events_select_authenticated" on public.events;
create policy "events_select_authenticated"
on public.events for select to authenticated
using (true);

drop policy if exists "events_insert_authenticated" on public.events;
create policy "events_insert_authenticated"
on public.events for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "events_update_owner_or_treasurer" on public.events;
create policy "events_update_owner_or_treasurer"
on public.events for update to authenticated
using (created_by = auth.uid() or public.is_admin_or_treasurer())
with check (created_by = auth.uid() or public.is_admin_or_treasurer());

drop policy if exists "events_delete_owner_or_treasurer" on public.events;
create policy "events_delete_owner_or_treasurer"
on public.events for delete to authenticated
using (created_by = auth.uid() or public.is_admin_or_treasurer());

drop policy if exists "prayer_notes_select_authenticated" on public.prayer_notes;
create policy "prayer_notes_select_authenticated"
on public.prayer_notes for select to authenticated
using (true);

drop policy if exists "prayer_notes_insert_authenticated" on public.prayer_notes;
create policy "prayer_notes_insert_authenticated"
on public.prayer_notes for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "prayer_notes_update_owner_or_admin" on public.prayer_notes;
create policy "prayer_notes_update_owner_or_admin"
on public.prayer_notes for update to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "prayer_notes_delete_owner_or_admin" on public.prayer_notes;
create policy "prayer_notes_delete_owner_or_admin"
on public.prayer_notes for delete to authenticated
using (created_by = auth.uid() or public.is_admin());

-- Private bucket untuk avatar dan lampiran kegiatan.
insert into storage.buckets (id, name, public)
values ('ikt-files', 'ikt-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "ikt_files_select_authenticated" on storage.objects;
create policy "ikt_files_select_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'ikt-files');

drop policy if exists "ikt_files_insert_own_folder" on storage.objects;
create policy "ikt_files_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ikt-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "ikt_files_update_own_folder" on storage.objects;
create policy "ikt_files_update_own_folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'ikt-files'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
)
with check (
  bucket_id = 'ikt-files'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "ikt_files_delete_own_folder" on storage.objects;
create policy "ikt_files_delete_own_folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ikt-files'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);