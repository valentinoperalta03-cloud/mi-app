-- Elimina el sistema de ELO: profiles.category pasa a ser la única fuente de
-- verdad de nivel. Recrea la vista de superadmin sin las columnas de ELO
-- antes de poder dropearlas (la vista las referencia).

drop view if exists public.superadmin_profiles_overview;

create view public.superadmin_profiles_overview
with (security_invoker = true)
as
select
  p.user_id,
  p.name,
  p.avatar_url,
  p.created_at as profile_created_at,
  p.matches_played,
  p.wins,
  p.category,
  p.is_globally_blocked,
  public.superadmin_auth_user_email(p.user_id) as email
from public.profiles p
where public.is_superadmin();

revoke all on public.superadmin_profiles_overview from public, anon;
grant select on public.superadmin_profiles_overview to authenticated, service_role;

alter table public.profiles
  drop column if exists level,
  drop column if exists level_of_play,
  drop column if exists technical_score,
  drop column if exists is_leveled,
  drop column if exists base_level;

alter table public.match_results
  rename column elo_applied_at to result_processed_at;
