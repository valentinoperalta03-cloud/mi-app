-- Consenso de resultado para partidos competitivos (estilo Playtomic).

alter table public.matches
  add column if not exists result_status text default null;

alter table public.matches
  add column if not exists result_locked_by uuid references auth.users(id);

alter table public.matches
  add column if not exists result_locked_team text;

alter table public.matches
  add column if not exists result_lock_expires_at timestamptz;

alter table public.match_results
  add column if not exists status text default 'pending_confirmation';

alter table public.match_results
  add column if not exists proposed_by uuid references auth.users(id);

alter table public.match_results
  add column if not exists sets jsonb;

alter table public.match_results
  add column if not exists conflict_reason text;

alter table public.match_results
  add column if not exists elo_applied_at timestamptz;

create table if not exists public.match_result_confirmations (
  id uuid primary key default gen_random_uuid(),
  match_result_id uuid not null references public.match_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('confirm', 'dispute')),
  team_a_score integer,
  team_b_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(match_result_id, user_id)
);

create index if not exists match_result_confirmations_result_idx
  on public.match_result_confirmations(match_result_id);

alter table public.match_result_confirmations enable row level security;

drop policy if exists "match_result_confirmations_select_own" on public.match_result_confirmations;
create policy "match_result_confirmations_select_own" on public.match_result_confirmations
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.match_results mr
      join public.match_participants mp on mp.match_id = mr.match_id
      where mr.id = match_result_confirmations.match_result_id
        and mp.player_id = auth.uid()
    )
  );

drop policy if exists "match_result_confirmations_insert_own" on public.match_result_confirmations;
create policy "match_result_confirmations_insert_own" on public.match_result_confirmations
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "match_result_confirmations_update_own" on public.match_result_confirmations;
create policy "match_result_confirmations_update_own" on public.match_result_confirmations
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
