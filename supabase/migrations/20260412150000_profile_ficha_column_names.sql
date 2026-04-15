-- Alinea nombres de ficha técnica con preferred_hand, court_position, preferred_schedule.
-- Idempotente: solo renombra si existen las columnas de la migración anterior.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'dominant_hand'
  ) then
    alter table public.profiles rename column dominant_hand to preferred_hand;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'play_position'
  ) then
    alter table public.profiles rename column play_position to court_position;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'play_schedule'
  ) then
    alter table public.profiles rename column play_schedule to preferred_schedule;
  end if;
end $$;
