-- Solicitudes de unión a partidos
create table if not exists public.match_join_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique(match_id, player_id)
);

-- Votos de los jugadores sobre una solicitud
create table if not exists public.match_join_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.match_join_requests(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  vote boolean not null, -- true = aceptar, false = rechazar
  created_at timestamptz not null default now(),
  unique(request_id, voter_id)
);

-- Restricción de nivel en partidos
alter table public.matches
  add column if not exists level_restricted boolean not null default false;

-- RLS
alter table public.match_join_requests enable row level security;
alter table public.match_join_votes enable row level security;

create policy "requests_select" on public.match_join_requests
  for select to authenticated using (true);
create policy "requests_insert_own" on public.match_join_requests
  for insert to authenticated with check (auth.uid() = player_id);
create policy "requests_update" on public.match_join_requests
  for update to authenticated using (true);

create policy "votes_select" on public.match_join_votes
  for select to authenticated using (true);
create policy "votes_insert_own" on public.match_join_votes
  for insert to authenticated with check (auth.uid() = voter_id);
