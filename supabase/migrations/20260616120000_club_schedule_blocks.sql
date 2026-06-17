create table if not exists club_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  blocked_time text not null,
  created_at timestamptz default now(),
  unique (club_id, day_of_week, blocked_time)
);

alter table club_schedule_blocks enable row level security;

create policy "auth_select_club_schedule_blocks" on club_schedule_blocks
  for select using (auth.uid() is not null);

create policy "club_owners_insert_club_schedule_blocks" on club_schedule_blocks
  for insert with check (
    exists (
      select 1 from clubs
      where clubs.id = club_schedule_blocks.club_id
        and clubs.owner_id = auth.uid()
    )
  );

create policy "club_owners_delete_club_schedule_blocks" on club_schedule_blocks
  for delete using (
    exists (
      select 1 from clubs
      where clubs.id = club_schedule_blocks.club_id
        and clubs.owner_id = auth.uid()
    )
  );
