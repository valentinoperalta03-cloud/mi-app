-- Reservas sin seña — confirmación directa server-side (camino B).
--
-- AUTOCONTENIDA: no usa lock_court_day, clock_to_minutes, court_blocks.
-- duration_minutes ni create_reservation_hold — verificado contra producción
-- (pg_proc/information_schema) que ninguno de esos existe hoy. El solapamiento
-- horario se calcula inline con extract(epoch from time)/60, el mismo patrón
-- que ya usa generate_fixed_slot_occurrence (RPC real, deployada) para lo
-- mismo — no se inventa una primitiva nueva, se reutiliza la que ya corre en
-- producción sin depender de su definición (queda inline acá).
--
-- SEGURIDAD: EXECUTE se otorga SOLO a service_role. No es alcanzable desde el
-- cliente/browser bajo ninguna circunstancia — la única vía es la Server
-- Action reservarCancha() (app/(club)/[slug]/actions.ts), que ya autenticó al
-- jugador vía cookies de sesión (supabase.auth.getUser()) antes de invocar
-- esta función con el service client. Por eso el precio (p_total_price) es un
-- parámetro confiable: lo calcula resolveCourtSlotPrice() en esa Server
-- Action ANTES de esta llamada, con los mismos datos de pricing que usa el
-- camino con seña — nunca un valor que el navegador pueda mandar directo,
-- porque el navegador no tiene ninguna vía de invocar esta RPC (a diferencia
-- de si EXECUTE estuviera otorgado a 'authenticated', donde cualquier usuario
-- podría llamar supabase.rpc() desde el cliente con cualquier precio).
-- Aun así, la función revalida por su cuenta la relación club/cancha,
-- requires_deposit y mp_access_token — nunca confía en que la Server Action
-- haya hecho bien esos chequeos, son la garantía real, no una capa
-- redundante.
--
-- FUERA DE ALCANCE DELIBERADO: la validación de "ese horario está dentro del
-- horario de apertura de la cancha" (court_time_ranges / horario del club,
-- lib/court-slots.ts::isSlotWithinCourtHours) NO se replica acá. Es una
-- regla de negocio/UX (qué horarios se OFRECEN), no una garantía de dinero ni
-- de concurrencia — un turno fuera de horario no genera un estado inconsistente
-- ni pérdida de plata, y como esta RPC es inalcanzable fuera de la Server
-- Action (EXECUTE solo a service_role), esa capa YA es la única forma de
-- llegar acá. Replicar esa lógica (rangos variables por cancha y día de
-- semana) en SQL es trabajo real y se documenta como decisión consciente, no
-- un olvido.
--
-- CONCURRENCIA: comparte el mismo advisory lock (misma fórmula de clave) que
-- insert_reservation_hold_locked (20260923100200_reservation_hold_locked_
-- insert.sql) — cierra la carrera cruzada matches-vs-reservation_holds. Usa
-- inline la MISMA fórmula que usará lock_court_day cuando se despliegue
-- Torneos V2 (20260920100000_tournament_v2_scheduler.sql, no aplicada hoy):
-- hashtextextended('court_day:'||court_id||':'||fecha, 0). El día que esa
-- función exista, reemplazar la línea "perform pg_advisory_xact_lock(...)"
-- por "perform public.lock_court_day(p_court_id, p_scheduled_date)" es un
-- cambio mecánico, mismo hash, sin cambio de comportamiento.
--
-- BRECHAS PREEXISTENTES QUE ESTA MIGRACIÓN NO CIERRA (documentadas, no
-- nuevas): la reserva manual del club (app/admin/reservas/actions.ts) y la
-- generación de turnos fijos (generate_fixed_slot_occurrence, RPC real ya
-- deployada) NO toman este lock ni revalidan contra reservation_holds antes
-- de insertar en matches — así funcionan HOY en producción, antes de esta
-- migración. Esta RPC no empeora esa brecha: es tan segura contra esos dos
-- escritores como ya lo es el flujo de seña legacy hoy (ambos dependen
-- únicamente de sin_partidos_superpuestos/unique_court_slot_active como
-- última red, sin lock compartido con ellos). Cerrarla requeriría tocar esos
-- dos archivos, fuera del alcance de este pedido.

create or replace function public.create_direct_reservation(
  p_owner_id uuid,
  p_club_id uuid,
  p_court_id uuid,
  p_scheduled_date date,
  p_scheduled_time time,
  p_duration_minutes integer,
  p_total_price numeric,
  p_location_name text
)
returns table (ok boolean, reason text, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_min integer;
  v_duration integer;
  v_active_count integer;
  v_requires_deposit boolean;
  v_has_mp boolean;
  v_match_id uuid;
begin
  -- Autenticación: defensa en profundidad. La garantía real es que EXECUTE
  -- está otorgado únicamente a service_role (ver GRANT al final) — el
  -- navegador no puede invocar esta función bajo ningún auth.uid(). Este
  -- chequeo protege contra un error futuro de grants, no es la barrera
  -- principal.
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_owner_id then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
  end if;

  if p_owner_id is null or p_club_id is null or p_court_id is null
     or p_scheduled_date is null or p_scheduled_time is null then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;
  if p_total_price is null or p_total_price <= 0 then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;
  v_duration := coalesce(nullif(p_duration_minutes, 0), 90);
  if v_duration < 10 or v_duration > 600 then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;

  -- Club y cancha existentes y relacionados correctamente: la Server Action
  -- ya lo valida, pero esta RPC no confía en eso — lo revalida contra la
  -- fuente real.
  if not exists (
    select 1 from courts c where c.id = p_court_id and c.club_id = p_club_id
  ) then
    return query select false, 'court_not_found'::text, null::uuid; return;
  end if;

  -- Fuente de verdad server-side para la configuración de seña y la conexión
  -- de Mercado Pago: nunca se confía en lo que decidió la Server Action al
  -- elegir esta RPC en vez de la del camino con seña.
  select requires_deposit, (mp_access_token is not null and mp_access_token <> '')
    into v_requires_deposit, v_has_mp
    from clubs where id = p_club_id;
  if v_requires_deposit is null or v_requires_deposit then
    return query select false, 'deposit_required'::text, null::uuid; return;
  end if;
  if not coalesce(v_has_mp, false) then
    return query select false, 'mp_not_connected'::text, null::uuid; return;
  end if;

  -- Único advisory lock de esta transacción: serializa contra cualquier otra
  -- llamada a create_direct_reservation o a insert_reservation_hold_locked
  -- para el MISMO court_id+fecha. Un solo recurso, sin locks de fila
  -- adicionales antes o después → no hay ciclo de espera posible entre estas
  -- dos funciones.
  perform pg_advisory_xact_lock(
    hashtextextended('court_day:' || p_court_id::text || ':' || p_scheduled_date::text, 0)
  );

  v_start_min := (extract(epoch from p_scheduled_time)::integer) / 60;

  -- Bloqueo puntual exacto (torneo ya agendado o bloqueo manual). court_blocks
  -- no tiene columna de duración en producción hoy — mismo criterio de hora
  -- exacta que ya usa admin/reservas/actions.ts y create_reservation_hold
  -- (no aplicada) para lo mismo.
  if exists (
    select 1 from court_blocks cb
    where cb.court_id = p_court_id
      and ((cb.blocked_date = p_scheduled_date and cb.blocked_time = p_scheduled_time)
        or (cb.date = p_scheduled_date and cb.start_time = p_scheduled_time))
  ) then
    return query select false, 'court_blocked'::text, null::uuid; return;
  end if;

  -- Solapamiento contra RESERVAS CONFIRMADAS: rango completo, no hora exacta.
  -- Una reserva de 16:30 a 18:00 (90 min) bloquea cualquier intento que
  -- empiece entre las 15:01 y las 17:59.
  if exists (
    select 1 from matches m
    where m.court_id = p_court_id
      and m.scheduled_date = p_scheduled_date
      and coalesce(m.match_status, '') <> 'cancelled'
      and v_start_min < (extract(epoch from m.scheduled_time)::integer) / 60
                         + coalesce(nullif(m.duration_minutes, 0), 90)
      and (extract(epoch from m.scheduled_time)::integer) / 60 < v_start_min + v_duration
  ) then
    return query select false, 'slot_conflict'::text, null::uuid; return;
  end if;

  -- Solapamiento contra HOLDS DE PAGO vigentes de cualquier jugador: mismo
  -- rango completo. Sin esto, un intento de reserva sin seña podía colarse
  -- entre las 17:00 y las 18:00 mientras otro jugador paga la seña de un
  -- turno de 16:30 a 18:00 en la misma cancha.
  if exists (
    select 1 from reservation_holds h
    where h.court_id = p_court_id
      and h.scheduled_date = p_scheduled_date
      and h.status = 'pending'
      and h.expires_at > now()
      and v_start_min < (extract(epoch from h.scheduled_time)::integer) / 60
                         + coalesce(nullif(h.duration_minutes, 0), 90)
      and (extract(epoch from h.scheduled_time)::integer) / 60 < v_start_min + v_duration
  ) then
    return query select false, 'slot_conflict'::text, null::uuid; return;
  end if;

  -- Reserva confirmada duplicada del propio owner en ese court+fecha+hora
  -- exacta (chequeo de negocio, no de solapamiento — un jugador no puede
  -- tener dos reservas propias que arranquen a la misma hora en la misma
  -- cancha; si son horarios distintos no es un duplicado).
  if exists (
    select 1 from matches m
    where m.owner_id = p_owner_id
      and m.court_id = p_court_id
      and m.scheduled_date = p_scheduled_date
      and m.scheduled_time = p_scheduled_time
      and coalesce(m.match_status, '') <> 'cancelled'
  ) then
    return query select false, 'already_reserved'::text, null::uuid; return;
  end if;

  -- Checkout de MP en curso del propio owner (cualquier cancha): evita
  -- confirmar una segunda reserva mientras paga la primera.
  if exists (
    select 1 from reservation_holds where owner_id = p_owner_id and status = 'pending' and expires_at > now()
  ) then
    return query select false, 'pending_hold_exists'::text, null::uuid; return;
  end if;

  -- Techo de reservas/partidos activos. Incluye club_pending: una reserva sin
  -- seña ya confirmada cuenta como activa igual que cualquier otra.
  select count(*) into v_active_count
  from matches
  where owner_id = p_owner_id
    and match_status in ('scheduled', 'reserved', 'full')
    and payment_status in ('paid', 'pending', 'cash_pending', 'transfer_pending', 'club_pending');
  if v_active_count >= 3 then
    return query select false, 'too_many_active'::text, null::uuid; return;
  end if;

  begin
    insert into matches (
      match_type, match_status, payment_status, financial_status,
      total_price, amount_paid, amount_pending, scheduled_date, scheduled_time,
      duration_minutes, court_id, owner_id, location_name, date, confirmed_at
    ) values (
      'reservation', 'reserved', 'club_pending', 'unpaid',
      p_total_price, 0, p_total_price, p_scheduled_date, p_scheduled_time,
      v_duration, p_court_id, p_owner_id, p_location_name,
      -- matches.date es timestamp WITHOUT time zone: date + time, SIN cast
      -- desde timestamptz (mismo fix aplicado manualmente en producción a
      -- consume_reservation_hold el 2026-09-18, ver
      -- 20260922100000_fix_consume_reservation_hold_timezone.sql en el
      -- working tree principal — no aplicada, pero el bug que corrige ya
      -- fue verificado y corregido en prod).
      p_scheduled_date + p_scheduled_time,
      now()
    )
    returning id into v_match_id;
  exception
    -- sin_partidos_superpuestos (EXCLUDE, verificado en producción): última
    -- red si, pese a las validaciones de arriba, otra transacción ganó la
    -- carrera antes del INSERT.
    when exclusion_violation then
      return query select false, 'slot_conflict'::text, null::uuid; return;
    -- unique_court_slot_active (UNIQUE btree sobre court_id+scheduled_date+
    -- scheduled_time, verificado en producción desde
    -- 20260515090000_club_hours_closed_days_slot_unique.sql): vía de
    -- conflicto distinta a la EXCLUDE para el mismo slot exacto.
    when unique_violation then
      return query select false, 'slot_conflict'::text, null::uuid; return;
  end;

  insert into match_participants (match_id, player_id, team)
  values (v_match_id, p_owner_id, 1);

  return query select true, 'ok'::text, v_match_id;
end;
$$;

-- EXECUTE solo para service_role: esta RPC nunca debe ser alcanzable desde
-- el cliente/browser. El precio, la fecha y el horario son confiables
-- ÚNICAMENTE porque la única vía de invocación es la Server Action, que ya
-- los calculó/validó server-side antes de llamar.
revoke all on function public.create_direct_reservation(uuid, uuid, uuid, date, time, integer, numeric, text) from public, anon, authenticated;
grant execute on function public.create_direct_reservation(uuid, uuid, uuid, date, time, integer, numeric, text) to service_role;
