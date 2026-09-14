-- Log audit hanya dapat dibaca admin master. Email dicek dari auth.users,
-- bukan user_metadata yang bisa diubah dari klien.

insert into public.app_settings (setting_key, setting_value)
values ('master_admin_email', 'ajip3580@gmail.com')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = timezone('utc', now());

create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    join public.app_settings s on s.setting_key = 'master_admin_email'
    where u.id = auth.uid()
      and lower(trim(coalesce(u.email, ''))) = lower(trim(s.setting_value))
      and p.role = 'admin'::public.app_role
      and p.is_active = true
  );
$$;

revoke all on function public.is_master_admin() from public, anon;
grant execute on function public.is_master_admin() to authenticated;

drop policy if exists "audit_log_select_manager" on public.audit_log;
drop policy if exists "audit_log_select_master" on public.audit_log;
create policy "audit_log_select_master"
on public.audit_log for select to authenticated
using (public.is_master_admin());

drop view if exists public.master_audit_log;
create view public.master_audit_log
with (security_invoker = true)
as
select
  a.id,
  a.actor_id,
  coalesce(nullif(trim(p.full_name), ''), 'Pengurus') as actor_name,
  a.action,
  a.success,
  a.details,
  a.occurred_at
from public.audit_log a
left join public.profiles p on p.id = a.actor_id;

revoke all on public.master_audit_log from public, anon, authenticated;
grant select on public.master_audit_log to authenticated, service_role;
