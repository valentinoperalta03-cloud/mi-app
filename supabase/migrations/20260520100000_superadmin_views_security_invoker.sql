-- Corrige vistas superadmin: SECURITY INVOKER + filtro is_superadmin() (sin RLS en vistas).
-- Reemplaza JOIN directo a auth.users por función acotada (evita exposición vía SECURITY DEFINER).

-- ── Helpers ───────────────────────────────────────────────────────────────────

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.role(), '') in ('service_role', 'supabase_admin')
    or exists (
      select 1
      from public.superadmins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

comment on function public.is_superadmin() is
  'true si el JWT pertenece a un email en public.superadmins o si el rol es service_role.';

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated, service_role;

create or replace function public.superadmin_auth_user_email(target_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if target_user_id is null then
    return null;
  end if;

  if not public.is_superadmin() then
    raise exception 'forbidden';
  end if;

  return (select u.email from auth.users u where u.id = target_user_id);
end;
$$;

comment on function public.superadmin_auth_user_email(uuid) is
  'Email de auth.users solo para superadmins (o service_role). Usado por vistas superadmin.';

revoke all on function public.superadmin_auth_user_email(uuid) from public;
grant execute on function public.superadmin_auth_user_email(uuid) to authenticated, service_role;

-- ── Vistas (SECURITY INVOKER + WHERE is_superadmin()) ───────────────────────────

drop view if exists public.superadmin_clubs_overview;
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
  p.technical_score,
  p.level_of_play,
  p.is_globally_blocked,
  public.superadmin_auth_user_email(p.user_id) as email
from public.profiles p
where public.is_superadmin();

create view public.superadmin_clubs_overview
with (security_invoker = true)
as
with club_courts as (
  select club_id, count(*)::int as courts_count
  from public.courts
  group by club_id
),
club_matches as (
  select
    ct.club_id,
    count(*) filter (
      where m.match_type = 'reservation' and coalesce(m.match_status, '') <> 'cancelled'
    )::int as reservations_total,
    count(*) filter (
      where m.match_type = 'reservation'
        and coalesce(m.match_status, '') <> 'cancelled'
        and m.scheduled_date >= date_trunc('month', current_date)::date
        and m.scheduled_date < (date_trunc('month', current_date) + interval '1 month')::date
    )::int as reservations_this_month,
    count(*) filter (
      where coalesce(m.match_type, '') <> 'reservation' and coalesce(m.match_status, '') <> 'cancelled'
    )::int as open_matches_total,
    count(*) filter (
      where coalesce(m.match_type, '') <> 'reservation'
        and coalesce(m.match_status, '') <> 'cancelled'
        and m.scheduled_date >= date_trunc('month', current_date)::date
        and m.scheduled_date < (date_trunc('month', current_date) + interval '1 month')::date
    )::int as open_matches_this_month,
    coalesce(
      sum(m.total_price) filter (
        where m.match_type = 'reservation'
          and coalesce(m.match_status, '') <> 'cancelled'
          and lower(coalesce(m.payment_status, '')) = 'paid'
      ),
      0
    )::numeric as revenue_paid_total,
    coalesce(
      sum(m.total_price) filter (
        where m.match_type = 'reservation'
          and coalesce(m.match_status, '') <> 'cancelled'
          and lower(coalesce(m.payment_status, '')) = 'paid'
          and m.scheduled_date >= date_trunc('month', current_date)::date
          and m.scheduled_date < (date_trunc('month', current_date) + interval '1 month')::date
      ),
      0
    )::numeric as revenue_paid_this_month,
    max(m.scheduled_date) filter (
      where m.match_type = 'reservation' and coalesce(m.match_status, '') <> 'cancelled'
    ) as last_reservation_date
  from public.courts ct
  left join public.matches m on m.court_id = ct.id
  group by ct.club_id
),
club_debt as (
  select club_id, coalesce(sum(amount), 0)::numeric as pending_debt
  from public.club_debts
  where status = 'pending'
  group by club_id
),
club_players_30d as (
  select
    ct.club_id,
    count(distinct mp.player_id)::int as unique_players_30d
  from public.courts ct
  join public.matches m on m.court_id = ct.id
  join public.match_participants mp on mp.match_id = m.id
  where m.scheduled_date >= (current_date - interval '30 days')::date
    and coalesce(m.match_status, '') <> 'cancelled'
  group by ct.club_id
)
select
  c.id,
  c.name,
  c.location,
  c.owner_id,
  c.created_at as club_created_at,
  c.is_active,
  c.onboarding_completed,
  c.mp_access_token,
  (c.mp_access_token is not null and btrim(c.mp_access_token) <> '') as mp_connected,
  public.superadmin_auth_user_email(c.owner_id) as owner_email,
  coalesce(cc.courts_count, 0) as courts_count,
  coalesce(cm.reservations_total, 0) as reservations_total,
  coalesce(cm.reservations_this_month, 0) as reservations_this_month,
  coalesce(cm.open_matches_total, 0) as open_matches_total,
  coalesce(cm.open_matches_this_month, 0) as open_matches_this_month,
  coalesce(cm.revenue_paid_total, 0) as revenue_paid_total,
  coalesce(cm.revenue_paid_this_month, 0) as revenue_paid_this_month,
  coalesce(cd.pending_debt, 0) as pending_debt,
  cm.last_reservation_date,
  coalesce(cp.unique_players_30d, 0) as unique_players_30d
from public.clubs c
left join club_courts cc on cc.club_id = c.id
left join club_matches cm on cm.club_id = c.id
left join club_debt cd on cd.club_id = c.id
left join club_players_30d cp on cp.club_id = c.id
where public.is_superadmin();

-- ── Permisos ──────────────────────────────────────────────────────────────────

revoke all on public.superadmin_profiles_overview from public, anon;
revoke all on public.superadmin_clubs_overview from public, anon;

grant select on public.superadmin_profiles_overview to authenticated, service_role;
grant select on public.superadmin_clubs_overview to authenticated, service_role;
