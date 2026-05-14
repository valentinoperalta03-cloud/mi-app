-- Panel superadmin: tabla de emails, tickets, club activo, bloqueo global, vistas de lectura (service_role).

create table if not exists public.superadmins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

insert into public.superadmins (email) values
  ('valentinoperalta03@gmail.com'),
  ('soporte.padelibre@gmail.com')
on conflict (email) do nothing;

alter table public.clubs add column if not exists is_active boolean not null default true;

alter table public.profiles add column if not exists is_globally_blocked boolean not null default false;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  club_id uuid references public.clubs (id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_created_idx on public.support_tickets (created_at desc);

alter table public.superadmins enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "superadmins no access" on public.superadmins;
create policy "superadmins no access" on public.superadmins for all using (false);

drop policy if exists "support_tickets no access" on public.support_tickets;
create policy "support_tickets no access" on public.support_tickets for all using (false);

create or replace view public.superadmin_clubs_overview as
select
  c.id,
  c.name,
  c.location,
  c.owner_id,
  c.created_at as club_created_at,
  c.is_active,
  c.mp_access_token,
  au.email as owner_email
from public.clubs c
left join auth.users au on au.id = c.owner_id;

grant select on public.superadmin_clubs_overview to service_role;

create or replace view public.superadmin_profiles_overview as
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
  au.email
from public.profiles p
left join auth.users au on au.id = p.user_id;

grant select on public.superadmin_profiles_overview to service_role;
