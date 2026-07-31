-- Sistema de agendamiento de videollamadas PadeLibre (Google Calendar + Meet + Resend).
-- Ambas tablas son de acceso exclusivo service_role: la página pública /agenda y el panel
-- superadmin usan endpoints de API, no el cliente Supabase directo.

create table if not exists public.meeting_availability (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=domingo, 6=sábado
  start_time time not null,
  end_time time not null,
  slot_duration_minutes integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  club_name text not null,
  email text not null,
  phone text not null,
  meeting_date date not null,
  meeting_time time not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  google_event_id text,
  meet_link text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists meetings_date_idx on public.meetings (meeting_date);
create index if not exists meetings_status_idx on public.meetings (status);
create index if not exists meeting_availability_day_idx on public.meeting_availability (day_of_week);

-- Evita doble booking del mismo horario a nivel de base de datos (las reuniones canceladas no cuentan).
create unique index if not exists meetings_slot_unique_idx
  on public.meetings (meeting_date, meeting_time)
  where status <> 'cancelled';

alter table public.meeting_availability enable row level security;
alter table public.meetings enable row level security;

drop policy if exists "meeting_availability no access" on public.meeting_availability;
create policy "meeting_availability no access" on public.meeting_availability for all using (false);

drop policy if exists "meetings no access" on public.meetings;
create policy "meetings no access" on public.meetings for all using (false);
