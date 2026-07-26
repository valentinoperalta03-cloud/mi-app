-- Peñas: tablas nuevas, RLS. No modifica tablas existentes.

-- ---------------------------------------------------------------------------
-- penas
-- ---------------------------------------------------------------------------
create table if not exists public.penas (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,

  name text not null,
  description text,
  what_includes text[],

  date date not null,
  start_time time not null,
  duration_minutes integer not null default 90,

  level text not null,
  game_format text,
  max_players integer not null,
  price_per_player numeric not null default 0,

  accepts_mp boolean not null default true,
  accepts_cash boolean not null default true,
  accepts_transfer boolean not null default false,
  transfer_alias text,

  cancellation_hours integer not null default 24,

  status text not null default 'draft'
    check (status in ('draft', 'published', 'in_progress', 'finished', 'cancelled')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists penas_club_id_idx on public.penas (club_id);
create index if not exists penas_date_idx on public.penas (date);
create index if not exists penas_status_idx on public.penas (status);

-- ---------------------------------------------------------------------------
-- pena_registrations
-- ---------------------------------------------------------------------------
create table if not exists public.pena_registrations (
  id uuid primary key default gen_random_uuid(),
  pena_id uuid not null references public.penas (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,

  status text not null default 'registered'
    check (status in ('registered', 'waitlist', 'cancelled')),

  payment_method text check (payment_method in ('mercadopago', 'cash', 'transfer')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'confirmed', 'refunded')),
  amount numeric default 0,
  mp_payment_id text,

  registered_at timestamptz not null default now(),

  unique (pena_id, player_id)
);

create index if not exists pena_registrations_pena_id_idx on public.pena_registrations (pena_id);
create index if not exists pena_registrations_player_id_idx on public.pena_registrations (player_id);

-- ---------------------------------------------------------------------------
-- pena_round_matches
-- ---------------------------------------------------------------------------
create table if not exists public.pena_round_matches (
  id uuid primary key default gen_random_uuid(),
  pena_id uuid not null references public.penas (id) on delete cascade,

  pair1_player1_id uuid references auth.users (id) on delete set null,
  pair1_player2_id uuid references auth.users (id) on delete set null,
  pair2_player1_id uuid references auth.users (id) on delete set null,
  pair2_player2_id uuid references auth.users (id) on delete set null,

  court_id uuid references public.courts (id) on delete set null,

  match_order integer not null default 1,

  created_at timestamptz not null default now()
);

create index if not exists pena_round_matches_pena_id_idx on public.pena_round_matches (pena_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.penas enable row level security;
alter table public.pena_registrations enable row level security;
alter table public.pena_round_matches enable row level security;

-- penas: lectura publica de peñas publicadas/en curso
create policy "penas_select_published"
  on public.penas for select to authenticated using (
    status in ('published', 'in_progress')
  );

-- penas: dueño del club, CRUD completo (incluye ver sus propios drafts)
create policy "penas_owner_all"
  on public.penas for all to authenticated using (
    exists (
      select 1 from public.clubs c
      where c.id = penas.club_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.clubs c
      where c.id = penas.club_id and c.owner_id = auth.uid()
    )
  );

-- pena_registrations: el jugador ve sus propias inscripciones
create policy "pena_registrations_select_self"
  on public.pena_registrations for select to authenticated using (
    player_id = auth.uid()
  );

-- pena_registrations: el dueño del club ve todas las inscripciones de su peña
create policy "pena_registrations_select_owner"
  on public.pena_registrations for select to authenticated using (
    exists (
      select 1 from public.penas p
      join public.clubs c on c.id = p.club_id
      where p.id = pena_registrations.pena_id and c.owner_id = auth.uid()
    )
  );

-- pena_registrations: insertar la propia inscripción
create policy "pena_registrations_insert_self"
  on public.pena_registrations for insert to authenticated with check (
    player_id = auth.uid()
  );

-- pena_round_matches: cualquier inscripto en la peña puede leer
create policy "pena_round_matches_select_registered"
  on public.pena_round_matches for select to authenticated using (
    exists (
      select 1 from public.pena_registrations r
      where r.pena_id = pena_round_matches.pena_id and r.player_id = auth.uid()
    )
  );

-- pena_round_matches: dueño del club, CRUD completo
create policy "pena_round_matches_owner_write"
  on public.pena_round_matches for all to authenticated using (
    exists (
      select 1 from public.penas p
      join public.clubs c on c.id = p.club_id
      where p.id = pena_round_matches.pena_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.penas p
      join public.clubs c on c.id = p.club_id
      where p.id = pena_round_matches.pena_id and c.owner_id = auth.uid()
    )
  );
