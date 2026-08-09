-- Entrenamientos externos (bloquean cancha, no visibles para jugadores)
-- y franjas horarias multiples por cancha/dia.

create table if not exists training_blocks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  title text not null,
  coach text,
  modality text,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists court_time_ranges (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  created_at timestamptz not null default now(),
  unique (court_id, day_of_week, open_time)
);

alter table training_blocks enable row level security;
alter table court_time_ranges enable row level security;

create policy "club owner manages training_blocks"
on training_blocks for all
using (club_id in (select id from clubs where owner_id = auth.uid()))
with check (club_id in (select id from clubs where owner_id = auth.uid()));

create policy "club owner manages court_time_ranges"
on court_time_ranges for all
using (court_id in (select id from courts where club_id in (
  select id from clubs where owner_id = auth.uid()
)))
with check (court_id in (select id from courts where club_id in (
  select id from clubs where owner_id = auth.uid()
)));

-- Los jugadores necesitan leer las franjas para calcular disponibilidad en
-- crear-partido-form.tsx (cliente, rol authenticated) — sin esto, RLS les
-- devuelve siempre vacio y el fallback al horario del club tapa el bug.
create policy "authenticated select court_time_ranges"
on court_time_ranges for select
using (auth.uid() is not null);

create index if not exists training_blocks_court_id_idx on training_blocks(court_id);
create index if not exists training_blocks_day_of_week_idx on training_blocks(day_of_week);
create index if not exists court_time_ranges_court_id_idx on court_time_ranges(court_id);
