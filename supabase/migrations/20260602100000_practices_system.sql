-- Prácticas / clases: coaches, plantillas, sesiones, inscripciones, RLS.

-- ---------------------------------------------------------------------------
-- practice_coaches (sin login; el club los gestiona)
-- ---------------------------------------------------------------------------
create table if not exists public.practice_coaches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  photo_url text,
  bio text,
  created_at timestamptz not null default now()
);

create index if not exists practice_coaches_club_id_idx on public.practice_coaches (club_id);

-- ---------------------------------------------------------------------------
-- practices (plantilla de clase)
-- ---------------------------------------------------------------------------
create table if not exists public.practices (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null,
  description text,
  modality text not null default 'group'
    check (modality in ('individual', 'group')),
  level_min numeric,
  level_max numeric,
  max_spots integer not null default 4,
  price_base numeric not null default 0,
  court_id uuid references public.courts (id) on delete set null,
  coach_id uuid references public.practice_coaches (id) on delete set null,
  recurrence_type text not null default 'once'
    check (recurrence_type in ('once', 'weekly')),
  start_date date not null,
  end_date date not null,
  start_time time not null,
  weekly_days smallint[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'open', 'finished', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists practices_club_id_idx on public.practices (club_id);
create index if not exists practices_status_idx on public.practices (status);

-- ---------------------------------------------------------------------------
-- practice_sessions (ocurrencia por fecha; inscripción por sesión)
-- ---------------------------------------------------------------------------
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  session_date date not null,
  start_time time not null,
  status text not null default 'open'
    check (status in ('open', 'finished', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (practice_id, session_date)
);

create index if not exists practice_sessions_practice_idx on public.practice_sessions (practice_id);
create index if not exists practice_sessions_date_idx on public.practice_sessions (session_date);

-- ---------------------------------------------------------------------------
-- practice_registrations
-- ---------------------------------------------------------------------------
create table if not exists public.practice_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'approved', 'cancelled', 'refunded')),
  mp_preference_id text,
  mp_payment_id text,
  amount numeric,
  registered_at timestamptz not null default now(),
  unique (session_id, player_id)
);

create index if not exists practice_registrations_session_idx
  on public.practice_registrations (session_id);
create index if not exists practice_registrations_player_idx
  on public.practice_registrations (player_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.practice_coaches enable row level security;
alter table public.practices enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_registrations enable row level security;

create policy "practice_coaches_select_auth"
  on public.practice_coaches for select to authenticated using (true);

create policy "practice_coaches_owner_all"
  on public.practice_coaches for all to authenticated using (
    exists (
      select 1 from public.clubs c
      where c.id = practice_coaches.club_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.clubs c
      where c.id = practice_coaches.club_id and c.owner_id = auth.uid()
    )
  );

create policy "practices_select_auth"
  on public.practices for select to authenticated using (true);

create policy "practices_owner_all"
  on public.practices for all to authenticated using (
    exists (
      select 1 from public.clubs c
      where c.id = practices.club_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.clubs c
      where c.id = practices.club_id and c.owner_id = auth.uid()
    )
  );

create policy "practice_sessions_select_auth"
  on public.practice_sessions for select to authenticated using (true);

create policy "practice_sessions_owner_all"
  on public.practice_sessions for all to authenticated using (
    exists (
      select 1 from public.practices p
      join public.clubs c on c.id = p.club_id
      where p.id = practice_sessions.practice_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.practices p
      join public.clubs c on c.id = p.club_id
      where p.id = practice_sessions.practice_id and c.owner_id = auth.uid()
    )
  );

create policy "practice_registrations_select_auth"
  on public.practice_registrations for select to authenticated using (true);

create policy "practice_registrations_insert_self"
  on public.practice_registrations for insert to authenticated with check (player_id = auth.uid());

create policy "practice_registrations_update_self"
  on public.practice_registrations for update to authenticated using (player_id = auth.uid())
  with check (player_id = auth.uid());

create policy "practice_registrations_owner_all"
  on public.practice_registrations for all to authenticated using (
    exists (
      select 1 from public.practice_sessions s
      join public.practices p on p.id = s.practice_id
      join public.clubs c on c.id = p.club_id
      where s.id = practice_registrations.session_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.practice_sessions s
      join public.practices p on p.id = s.practice_id
      join public.clubs c on c.id = p.club_id
      where s.id = practice_registrations.session_id and c.owner_id = auth.uid()
    )
  );

-- Notificaciones: tipo practice_event
alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'join_request',
    'join_approved',
    'join_rejected',
    'player_joined',
    'match_reminder',
    'result_pending',
    'match_result',
    'reservation_confirmed',
    'reservation_cancelled',
    'payment_approved',
    'payment_rejected',
    'level_up',
    'match_cancelled',
    'match_owner_changed',
    'new_follower',
    'now_friends',
    'new_message',
    'group_message',
    'added_to_group',
    'tournament_event',
    'club_agenda',
    'practice_event'
  ));
