-- Visibilidad de partidos: público (buscar partido) o privado (amigos + invitación).
alter table public.matches
  add column if not exists visibility text;

-- Normalizar valores legacy o vacíos antes del constraint.
update public.matches
set visibility = 'privado'
where visibility is not null
  and lower(trim(visibility)) in ('privado', 'private', 'privada');

update public.matches
set visibility = 'publico'
where visibility is null
  or trim(visibility) = ''
  or lower(trim(visibility)) not in ('publico', 'privado');

alter table public.matches
  alter column visibility set default 'publico';

alter table public.matches
  alter column visibility set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_visibility_check'
  ) then
    alter table public.matches
      add constraint matches_visibility_check
      check (visibility in ('publico', 'privado'));
  end if;
end $$;

comment on column public.matches.visibility is
  'publico = visible en buscar partido; privado = solo amigos del dueño e invitados.';
