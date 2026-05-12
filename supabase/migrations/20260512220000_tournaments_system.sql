-- Torneos: tablas, group_chats.tournament_id, RLS, tipos de notificación.

-- ---------------------------------------------------------------------------
-- group_chats: enlace opcional a torneo
-- ---------------------------------------------------------------------------
alter table public.group_chats
  add column if not exists tournament_id uuid;

-- FK se agrega tras crear tournaments (evita orden circular si no existía tournaments)

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  description text,
  tournament_type text not null
    check (tournament_type in ('americano', 'eliminacion', 'grupos_eliminacion', 'mixing')),
  category_min numeric,
  category_max numeric,
  max_pairs integer not null default 16,
  price_per_pair numeric not null default 0,
  prize text,
  start_date date not null,
  end_date date not null,
  start_time time not null,
  registration_deadline timestamptz not null,
  cancellation_hours integer not null default 24,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'finished', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  group_chat_id uuid references public.group_chats (id) on delete set null
);

create index if not exists tournaments_club_id_idx on public.tournaments (club_id);
create index if not exists tournaments_status_idx on public.tournaments (status);
create index if not exists tournaments_start_date_idx on public.tournaments (start_date desc);

alter table public.group_chats
  add constraint group_chats_tournament_id_fkey
  foreign key (tournament_id) references public.tournaments (id) on delete set null;

create index if not exists group_chats_tournament_id_idx on public.group_chats (tournament_id);

-- ---------------------------------------------------------------------------
-- tournament_registrations
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player1_id uuid not null references auth.users (id) on delete cascade,
  player2_id uuid references auth.users (id) on delete cascade,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'approved', 'cancelled', 'refunded')),
  mp_preference_id text,
  mp_payment_id text,
  amount numeric,
  waitlist boolean not null default false,
  registered_at timestamptz not null default now(),
  unique (tournament_id, player1_id)
);

create index if not exists tournament_registrations_tournament_idx
  on public.tournament_registrations (tournament_id);
create index if not exists tournament_registrations_player1_idx
  on public.tournament_registrations (player1_id);

-- ---------------------------------------------------------------------------
-- tournament_matches
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round integer not null,
  round_name text,
  court_id uuid references public.courts (id) on delete set null,
  scheduled_time timestamptz,
  pair1_id uuid references public.tournament_registrations (id) on delete set null,
  pair2_id uuid references public.tournament_registrations (id) on delete set null,
  pair1_score integer,
  pair2_score integer,
  sets jsonb,
  winner_pair_id uuid references public.tournament_registrations (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'finished')),
  feeder_left_match_id uuid references public.tournament_matches (id) on delete set null,
  feeder_right_match_id uuid references public.tournament_matches (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tournament_matches_tournament_idx
  on public.tournament_matches (tournament_id, round);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tournaments enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.tournament_matches enable row level security;

-- Lectura de torneos para usuarios autenticados (listado / detalle)
create policy "tournaments_select_auth"
  on public.tournaments for select to authenticated using (true);

-- Dueño del club: CRUD torneos de sus clubes
create policy "tournaments_owner_all"
  on public.tournaments for all to authenticated using (
    exists (
      select 1 from public.clubs c
      where c.id = tournaments.club_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.clubs c
      where c.id = tournaments.club_id and c.owner_id = auth.uid()
    )
  );

-- Inscripciones: lectura
create policy "tournament_registrations_select_auth"
  on public.tournament_registrations for select to authenticated using (true);

-- Insertar propia inscripción como player1
create policy "tournament_registrations_insert_self"
  on public.tournament_registrations for insert to authenticated with check (player1_id = auth.uid());

-- Dueño del club puede inscribir parejas manualmente
create policy "tournament_registrations_owner_insert"
  on public.tournament_registrations for insert to authenticated with check (
    exists (
      select 1 from public.tournaments t
      join public.clubs c on c.id = t.club_id
      where t.id = tournament_registrations.tournament_id and c.owner_id = auth.uid()
    )
  );

-- Actualizar fila donde sos payer (preferencia / webhook vía service role bypass)
create policy "tournament_registrations_update_self"
  on public.tournament_registrations for update to authenticated using (
    player1_id = auth.uid() or player2_id = auth.uid()
  ) with check (
    player1_id = auth.uid() or player2_id = auth.uid()
  );

-- Dueño del club puede gestionar inscripciones de sus torneos
create policy "tournament_registrations_owner_update"
  on public.tournament_registrations for update to authenticated using (
    exists (
      select 1 from public.tournaments t
      join public.clubs c on c.id = t.club_id
      where t.id = tournament_registrations.tournament_id and c.owner_id = auth.uid()
    )
  );

create policy "tournament_registrations_owner_delete"
  on public.tournament_registrations for delete to authenticated using (
    exists (
      select 1 from public.tournaments t
      join public.clubs c on c.id = t.club_id
      where t.id = tournament_registrations.tournament_id and c.owner_id = auth.uid()
    )
  );

-- Partidos del torneo: lectura
create policy "tournament_matches_select_auth"
  on public.tournament_matches for select to authenticated using (true);

-- Dueño del club: insert/update/delete partidos
create policy "tournament_matches_owner_write"
  on public.tournament_matches for all to authenticated using (
    exists (
      select 1 from public.tournaments t
      join public.clubs c on c.id = t.club_id
      where t.id = tournament_matches.tournament_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.tournaments t
      join public.clubs c on c.id = t.club_id
      where t.id = tournament_matches.tournament_id and c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Notificaciones: ampliar check para torneos
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'join_request',
    'join_approved',
    'join_rejected',
    'player_joined',
    'match_reminder',
    'result_pending',
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
    'tournament_event'
  ));
