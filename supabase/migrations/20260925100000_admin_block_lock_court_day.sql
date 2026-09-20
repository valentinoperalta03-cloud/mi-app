-- Torneos V2 · Fase D · Cierre de carrera pendiente: bloqueos manuales y
-- entrenamientos externos (/admin/bloqueos, /admin/clases).
--
-- Contexto: el comentario de 20260921100000 (punto "F") daba por cerrado este
-- writer con el argumento "son la ocupación en sí, no compiten con nadie más
-- por la misma fila". Eso era correcto ANTES de que existiera un segundo
-- escritor real de court_blocks: tournament_assign_match_slot (20260920100000)
-- SÍ escribe court_blocks (vía el trigger tournament_match_sync_court_block de
-- 20260917100000) y SÍ toma lock_court_day antes de chequear conflictos. Un
-- bloqueo manual o un entrenamiento externo que se crea en el mismo instante,
-- para la misma cancha+fecha, en un horario que SE SUPERPONE (no
-- necesariamente coincide hora exacta) con el partido que el torneo está
-- agendando, no lo iba a ver: createManualBlocksAction / createTrainingBlockAction
-- (app/admin/bloqueos/actions.ts, app/admin/clases/actions.ts) hacían
-- check → insert → recheck en JavaScript, en llamadas HTTP separadas sin
-- transacción ni lock compartido — la lectura de "¿hay conflicto?" nunca ve lo
-- que la transacción del torneo todavía no comiteó, con o sin recheck
-- posterior, porque el recheck tiene el mismo problema de visibilidad MVCC que
-- el chequeo original. Resultado posible: dos filas de court_blocks
-- superpuestas para la misma cancha+fecha, ninguna detectada, cancha
-- double-booked entre un partido de torneo y un bloqueo/entrenamiento.
--
-- Fix: una única RPC transaccional (mismo patrón que admin_create_manual_reservation,
-- 20260923100000) que toma lock_court_day ANTES de revalidar, así se serializa
-- contra tournament_assign_match_slot / create_direct_reservation /
-- insert_reservation_hold_locked / consume_reservation_hold / generate_fixed_slot_occurrence
-- / admin_create_manual_reservation — todos los escritores reales de ocupación
-- de cancha ya comparten esta misma primitiva. Revalida contra matches,
-- court_blocks (por RANGO, incluye torneo/otro bloqueo/otro entrenamiento) y
-- reservation_holds vigentes — las mismas tres fuentes que ya revalida
-- admin_create_manual_reservation. No se agrega chequeo contra fixed_slots ni
-- training_blocks acá: ese pre-chequeo informativo ya lo hace la Server Action
-- en JS (getDayActivity) antes de llamar a esta RPC, y no es la carrera bajo
-- auditoría (no hay un segundo escritor real tomando lock_court_day sobre esas
-- dos tablas). Ampliarlo queda fuera de alcance de este cierre puntual.
--
-- No se toca la firma pública de ninguna función existente ni el comportamiento
-- de columnas ya escritas — es una función nueva, y los dos callers (bloqueos,
-- entrenamientos) pasan a llamarla en vez de insertar directo.

create or replace function public.admin_create_court_block(
  p_owner_id uuid,
  p_club_id uuid,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_reason text,
  p_note text
)
returns table (ok boolean, reason text, block_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_min integer;
  v_duration integer;
  v_block_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_owner_id then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
    if not exists (select 1 from public.clubs c where c.id = p_club_id and c.owner_id = auth.uid()) then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
  end if;

  if not exists (select 1 from public.courts co where co.id = p_court_id and co.club_id = p_club_id) then
    return query select false, 'invalid_court'::text, null::uuid; return;
  end if;

  v_duration := coalesce(nullif(p_duration_minutes, 0), 90);
  if v_duration < 10 or v_duration > 600 then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;

  -- Mismo lock compartido que tournament_assign_match_slot / create_direct_reservation
  -- / insert_reservation_hold_locked / consume_reservation_hold /
  -- generate_fixed_slot_occurrence / admin_create_manual_reservation.
  perform public.lock_court_day(p_court_id, p_date);

  v_start_min := clock_to_minutes(p_start_time);

  -- Reservas/partidos reales ya confirmados.
  if exists (
    select 1 from public.matches m
    where m.court_id = p_court_id
      and m.scheduled_date = p_date
      and coalesce(m.match_status, '') <> 'cancelled'
      and v_start_min < clock_to_minutes(m.scheduled_time) + coalesce(nullif(m.duration_minutes, 0), 90)
      and clock_to_minutes(m.scheduled_time) < v_start_min + v_duration
  ) then
    return query select false, 'slot_conflict'::text, null::uuid; return;
  end if;

  -- Otro bloqueo (moderno y legacy), incluido cualquier partido de torneo ya
  -- agendado por tournament_assign_match_slot — por RANGO, no hora exacta.
  if exists (
    select 1 from public.court_blocks cb
    where cb.court_id = p_court_id
      and (
        (cb.blocked_date = p_date and cb.blocked_time is not null
          and v_start_min < clock_to_minutes(cb.blocked_time) + coalesce(nullif(cb.duration_minutes, 0), 90)
          and clock_to_minutes(cb.blocked_time) < v_start_min + v_duration)
        or
        (cb.date = p_date and cb.start_time is not null
          and v_start_min < clock_to_minutes(cb.start_time) + 90
          and clock_to_minutes(cb.start_time) < v_start_min + v_duration)
      )
  ) then
    return query select false, 'court_blocked'::text, null::uuid; return;
  end if;

  -- Hold de pago vigente (checkout de MP en curso).
  if exists (
    select 1 from public.reservation_holds h
    where h.court_id = p_court_id
      and h.scheduled_date = p_date
      and h.status = 'pending'
      and h.expires_at > now()
      and v_start_min < clock_to_minutes(h.scheduled_time) + coalesce(nullif(h.duration_minutes, 0), 90)
      and clock_to_minutes(h.scheduled_time) < v_start_min + v_duration
  ) then
    return query select false, 'reservation_hold_conflict'::text, null::uuid; return;
  end if;

  begin
    insert into public.court_blocks (
      court_id, date, start_time, blocked_date, blocked_time, duration_minutes, reason, note, created_by
    ) values (
      p_court_id, p_date, p_start_time, p_date, p_start_time, v_duration, p_reason, p_note, p_owner_id
    )
    returning id into v_block_id;
  exception when unique_violation then
    return query select false, 'court_blocked'::text, null::uuid; return;
  end;

  return query select true, 'ok'::text, v_block_id;
end;
$$;

revoke all on function public.admin_create_court_block(uuid, uuid, uuid, date, time, integer, text, text) from public, anon;
grant execute on function public.admin_create_court_block(uuid, uuid, uuid, date, time, integer, text, text) to authenticated, service_role;
