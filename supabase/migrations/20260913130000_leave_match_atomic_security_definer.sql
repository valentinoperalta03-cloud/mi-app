-- Mismo bug que join_match_atomic (ver migracion 20260913120000): leave_match_atomic
-- es security invoker y hace SELECT ... FOR UPDATE sobre matches, que bajo RLS
-- tambien exige pasar la policy de UPDATE de esa tabla (auth.uid() = owner_id).
-- Resultado: un jugador que cancela su propio lugar en un partido que NO le
-- pertenece (el caso normal: te unis al partido de otro y despues cancelas)
-- nunca encontraba la fila -> 'match_not_found' -> "No pudimos liberar tu
-- lugar. Intenta de nuevo." SIEMPRE, salvo que el que cancela sea el dueno.
--
-- A diferencia de join_match_atomic, esta funcion no tenia ningun chequeo
-- manual de auth.uid() (confiaba enteramente en RLS). Se agrega explicitamente
-- antes de pasar a security definer, para no abrir la puerta a que un usuario
-- saque a otro jugador del partido: ambos callers de la app (partidos/[id] y
-- buscar-partido) siempre pasan p_player_id = auth.uid() del que cancela.
create or replace function public.leave_match_atomic(
  p_match_id uuid,
  p_player_id uuid
)
returns table (
  match_id uuid,
  owner_before uuid,
  owner_after uuid,
  cancelled boolean,
  slot_released boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_court_id uuid;
  v_scheduled_date date;
  v_scheduled_time time;
  v_count int;
  v_new_owner uuid;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_player_id then
    raise exception 'forbidden';
  end if;

  select m.owner_id, m.court_id, m.scheduled_date, m.scheduled_time
  into v_owner, v_court_id, v_scheduled_date, v_scheduled_time
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  delete from public.match_participants mp
  where mp.match_id = p_match_id
    and mp.player_id = p_player_id;

  if not found then
    raise exception 'participant_not_found';
  end if;

  select count(*)::int into v_count
  from public.match_participants mp
  where mp.match_id = p_match_id;

  if v_owner = p_player_id then
    if v_count = 0 then
      update public.matches
      set match_status = 'cancelled',
          payment_status = 'cancelled'
      where id = p_match_id;

      delete from public.court_blocks cb
      where cb.court_id = v_court_id
        and (
          (cb.blocked_date = v_scheduled_date and cb.blocked_time = v_scheduled_time)
          or (cb.date = v_scheduled_date and cb.start_time = v_scheduled_time)
        );

      return query
      select p_match_id, v_owner, null::uuid, true, true;
    else
      select mp.player_id into v_new_owner
      from public.match_participants mp
      where mp.match_id = p_match_id
      order by mp.created_at nulls last, mp.player_id
      limit 1;

      update public.matches
      set owner_id = v_new_owner
      where id = p_match_id;

      return query
      select p_match_id, p_player_id, v_new_owner, false, false;
    end if;
  end if;

  return query
  select p_match_id, v_owner, v_owner, false, false;
end;
$$;

grant execute on function public.leave_match_atomic(uuid, uuid) to authenticated, service_role;
