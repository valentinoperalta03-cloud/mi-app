-- Bug: revenue_paid_total/revenue_paid_this_month sumaban total_price (precio
-- completo del turno) en vez de amount_paid (lo efectivamente cobrado). Con el
-- modelo de senas, payment_status='paid' puede corresponder solo a la sena.
-- Mismo bug ya corregido en finance-module.tsx; se redefine la vista con
-- las mismas columnas para no romper los componentes que la consumen.
drop view if exists public.superadmin_clubs_overview;
create view public.superadmin_clubs_overview as
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
      sum(m.amount_paid) filter (
        where m.match_type = 'reservation'
          and coalesce(m.match_status, '') <> 'cancelled'
          and lower(coalesce(m.payment_status, '')) = 'paid'
      ),
      0
    )::numeric as revenue_paid_total,
    coalesce(
      sum(m.amount_paid) filter (
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
  au.email as owner_email,
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
left join auth.users au on au.id = c.owner_id
left join club_courts cc on cc.club_id = c.id
left join club_matches cm on cm.club_id = c.id
left join club_debt cd on cd.club_id = c.id
left join club_players_30d cp on cp.club_id = c.id;

grant select on public.superadmin_clubs_overview to service_role;
