-- PostgreSQL tidak memiliki deny privilege: revoke SELECT(phone) tidak dapat
-- mengalahkan grant SELECT seluruh tabel. Cabut grant tabel lalu whitelist
-- kolom profil yang memang diperlukan user login.
revoke select on public.profiles from authenticated;
grant select (
  id,
  full_name,
  avatar_url,
  role,
  member_type,
  arrears_periods,
  is_active,
  joined_at,
  created_at,
  updated_at
)
on public.profiles to authenticated;

-- Tabel status legacy memiliki phone untuk kebutuhan import/pencocokan internal.
-- Jangan wariskan akses SELECT tabel penuh kepada user authenticated biasa.
revoke select on public.legacy_contribution_status from authenticated;
grant select (
  id,
  source_period_label,
  member_name,
  member_type,
  payment_status,
  arrears,
  matched_profile_id,
  created_at,
  updated_at
)
on public.legacy_contribution_status to authenticated;