-- RLS en turnos fijos: antes anon/authenticated podían leer/escribir sin restricción.

alter table public.fixed_slots enable row level security;
alter table public.fixed_slot_players enable row level security;
alter table public.fixed_slot_exceptions enable row level security;

drop policy if exists "Club owner can manage fixed_slots" on public.fixed_slots;
create policy "Club owner can manage fixed_slots"
on public.fixed_slots
for all
to authenticated
using (
  club_id in (
    select c.id from public.clubs c where c.owner_id = auth.uid()
  )
)
with check (
  club_id in (
    select c.id from public.clubs c where c.owner_id = auth.uid()
  )
);

drop policy if exists "Club owner can manage fixed_slot_players" on public.fixed_slot_players;
create policy "Club owner can manage fixed_slot_players"
on public.fixed_slot_players
for all
to authenticated
using (
  fixed_slot_id in (
    select fs.id
    from public.fixed_slots fs
    join public.clubs c on c.id = fs.club_id
    where c.owner_id = auth.uid()
  )
)
with check (
  fixed_slot_id in (
    select fs.id
    from public.fixed_slots fs
    join public.clubs c on c.id = fs.club_id
    where c.owner_id = auth.uid()
  )
);

drop policy if exists "Players can view their own fixed_slot_players" on public.fixed_slot_players;
create policy "Players can view their own fixed_slot_players"
on public.fixed_slot_players
for select
to authenticated
using (player_id = auth.uid());

drop policy if exists "Club owner can manage fixed_slot_exceptions" on public.fixed_slot_exceptions;
create policy "Club owner can manage fixed_slot_exceptions"
on public.fixed_slot_exceptions
for all
to authenticated
using (
  fixed_slot_id in (
    select fs.id
    from public.fixed_slots fs
    join public.clubs c on c.id = fs.club_id
    where c.owner_id = auth.uid()
  )
)
with check (
  fixed_slot_id in (
    select fs.id
    from public.fixed_slots fs
    join public.clubs c on c.id = fs.club_id
    where c.owner_id = auth.uid()
  )
);

drop policy if exists "Players can view their fixed_slot_exceptions" on public.fixed_slot_exceptions;
create policy "Players can view their fixed_slot_exceptions"
on public.fixed_slot_exceptions
for select
to authenticated
using (
  fixed_slot_id in (
    select fsp.fixed_slot_id
    from public.fixed_slot_players fsp
    where fsp.player_id = auth.uid()
  )
);
