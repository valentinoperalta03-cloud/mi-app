-- Wrapper interno del flujo de pago existente (reservarCancha, camino con
-- seña): envuelve el INSERT final en reservation_holds que hoy hace
-- app/(club)/[slug]/actions.ts directo desde el cliente de sesión, bajo el
-- MISMO advisory lock que create_direct_reservation (misma fórmula de
-- clave, ver 20260923100100_direct_reservation_rpc.sql) para cerrar la
-- carrera cruzada matches-vs-reservation_holds: sin esto, una reserva sin
-- seña podía comprobar "no hay hold" e insertar en matches al mismo tiempo
-- que una reserva con seña comprobaba "no hay match" e insertaba en
-- reservation_holds — cada INSERT protegido por los constraints de SU
-- propia tabla, ninguno viéndose entre sí.
--
-- No reemplaza ni toca ninguna otra parte del flujo legacy (expirar holds
-- vencidos, chequeo de duplicado propio, hold pendiente propio, tope de
-- activos, solapamiento previo): esas validaciones siguen corriendo en
-- TypeScript exactamente igual que hoy en producción, porque no interactúan
-- con la carrera cruzada — ya están protegidas por los constraints propios
-- de reservation_holds (one_pending_hold_per_owner, reservation_holds_no_
-- overlap) sin necesidad de este lock. Lo único que faltaba era la
-- revalidación contra `matches`.
--
-- SEGURIDAD: EXECUTE solo a service_role. No es una RPC de negocio genérica
-- — es un wrapper interno de una Server Action ya autenticada. Acepta
-- starts_at/ends_at/total_price/deposit_amount/expires_at tal cual los
-- calcula hoy reservarCancha() en TypeScript (misma lógica ya vigente en
-- producción, sin cambios); exponerla a 'authenticated' permitiría a
-- cualquier usuario crear un hold de pago con un monto o vencimiento
-- arbitrario.

create or replace function public.insert_reservation_hold_locked(
  p_owner_id uuid,
  p_club_id uuid,
  p_court_id uuid,
  p_scheduled_date date,
  p_scheduled_time time,
  p_duration_minutes integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_total_price numeric,
  p_deposit_amount numeric,
  p_location_name text,
  p_expires_at timestamptz
)
returns table (ok boolean, reason text, hold_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_min integer;
  v_duration integer;
  v_hold_id uuid;
begin
  -- Defensa en profundidad (ver mismo comentario en create_direct_reservation):
  -- la barrera real es el GRANT a service_role únicamente.
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_owner_id then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
  end if;

  if p_owner_id is null or p_club_id is null or p_court_id is null
     or p_scheduled_date is null or p_scheduled_time is null
     or p_starts_at is null or p_ends_at is null or p_expires_at is null then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;
  v_duration := coalesce(nullif(p_duration_minutes, 0), 90);

  -- Mismo advisory lock, misma fórmula de clave que create_direct_reservation
  -- (y que usará lock_court_day cuando se despliegue Torneos V2). Un único
  -- recurso por transacción, sin locks de fila adicionales → sin ciclos de
  -- espera posibles entre esta función y create_direct_reservation.
  perform pg_advisory_xact_lock(
    hashtextextended('court_day:' || p_court_id::text || ':' || p_scheduled_date::text, 0)
  );

  v_start_min := (extract(epoch from p_scheduled_time)::integer) / 60;

  -- Única revalidación NUEVA que este wrapper agrega sobre lo que el flujo
  -- legacy en TS ya hacía: que no exista una reserva CONFIRMADA (matches)
  -- que se solape con este intervalo. Rango completo (no solo hora exacta):
  -- una reserva de 16:30 a 18:00 también debe bloquear un hold que arranque
  -- a las 17:00. Las demás garantías (un solo hold pendiente por owner,
  -- no-overlap entre holds) ya las dan los constraints propios de
  -- reservation_holds sin necesidad de este chequeo.
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

  begin
    insert into reservation_holds (
      owner_id, club_id, court_id, scheduled_date, scheduled_time, duration_minutes,
      starts_at, ends_at, total_price, deposit_amount, location_name, status, expires_at
    ) values (
      p_owner_id, p_club_id, p_court_id, p_scheduled_date, p_scheduled_time, v_duration,
      p_starts_at, p_ends_at, p_total_price, p_deposit_amount, p_location_name, 'pending', p_expires_at
    )
    returning id into v_hold_id;
  exception
    -- one_pending_hold_per_owner (UNIQUE, verificado en producción).
    when unique_violation then
      return query select false, 'pending_hold_exists'::text, null::uuid; return;
    -- reservation_holds_no_overlap (EXCLUDE, verificado en producción).
    when exclusion_violation then
      return query select false, 'slot_conflict'::text, null::uuid; return;
  end;

  return query select true, 'ok'::text, v_hold_id;
end;
$$;

revoke all on function public.insert_reservation_hold_locked(uuid, uuid, uuid, date, time, integer, timestamptz, timestamptz, numeric, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function public.insert_reservation_hold_locked(uuid, uuid, uuid, date, time, integer, timestamptz, timestamptz, numeric, numeric, text, timestamptz) to service_role;
