-- Geolocalización por ciudad: perfiles y clubes

alter table public.profiles
  add column if not exists country text default 'Argentina',
  add column if not exists province text default 'Santa Fe',
  add column if not exists city text default 'rosario';

update public.clubs
set location = lower(trim(location))
where location is not null;

alter table public.clubs
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists country text default 'Argentina';

update public.clubs
set city = lower(trim(location))
where city is null and location is not null;

-- Backfill perfiles existentes sin ciudad
update public.profiles
set
  country = coalesce(country, 'Argentina'),
  province = coalesce(province, 'Santa Fe'),
  city = coalesce(nullif(lower(trim(city)), ''), 'rosario')
where city is null or trim(city) = '';

create or replace function public.get_clubs_by_city(user_city text)
returns table (
  id uuid,
  name text,
  location text,
  city text,
  address text,
  image_url text,
  logo_url text,
  contact_phone text,
  whatsapp text,
  instagram text,
  description text,
  business_hours text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.name,
    c.location,
    c.city,
    c.address,
    c.cover_image_url as image_url,
    c.logo_url,
    c.contact_phone,
    c.whatsapp,
    c.instagram,
    c.description,
    c.business_hours
  from public.clubs c
  where lower(coalesce(c.city, c.location, '')) = lower(user_city)
    and coalesce(c.is_active, true) = true
  order by c.name asc nulls last;
end;
$$;

create or replace function public.get_matches_by_city(user_city text)
returns table (
  id uuid,
  match_date date,
  match_time time,
  available_slots integer,
  club_id uuid,
  club_name text,
  club_city text,
  court_id uuid,
  court_name text,
  price_per_player numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return query
  select
    m.id,
    coalesce(m.scheduled_date, (m.date at time zone 'UTC')::date) as match_date,
    coalesce(m.scheduled_time, (m.date at time zone 'UTC')::time) as match_time,
    greatest(0, 4 - coalesce(mp.cnt, 0))::integer as available_slots,
    cl.id as club_id,
    cl.name as club_name,
    cl.city as club_city,
    ct.id as court_id,
    ct.name as court_name,
    case
      when coalesce(m.total_price, 0) > 0 then round((m.total_price * 1.05 / 4)::numeric, 2)
      else coalesce(ct.price, 0)
    end as price_per_player
  from public.matches m
  join public.courts ct on ct.id = m.court_id
  join public.clubs cl on cl.id = ct.club_id
  left join (
    select match_id, count(*)::integer as cnt
    from public.match_participants
    group by match_id
  ) mp on mp.match_id = m.id
  where lower(coalesce(cl.city, cl.location, '')) = lower(user_city)
    and lower(coalesce(m.match_status, '')) not in ('cancelled', 'reserved')
    and coalesce(m.date, (m.scheduled_date + coalesce(m.scheduled_time, time '00:00'))::timestamptz) >= now()
    and coalesce(cl.is_active, true) = true
    and coalesce(mp.cnt, 0) > 0
    and coalesce(mp.cnt, 0) < 4
  order by match_date asc, match_time asc;
end;
$$;

grant execute on function public.get_clubs_by_city(text) to authenticated;
grant execute on function public.get_matches_by_city(text) to authenticated;
