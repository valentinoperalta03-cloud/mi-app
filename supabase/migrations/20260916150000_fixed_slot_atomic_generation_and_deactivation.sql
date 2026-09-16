-- Turnos fijos: generación y baja permanente atómicas.
--
-- 1. Índice único parcial: una recurrencia no puede tener dos ocurrencias vivas
--    para la misma fecha. El histórico cancelado queda fuera del predicado.
--    Verificado antes de crear: 0 pares (fixed_slot_id, scheduled_date) vivos
--    duplicados en producción. match_status de turnos fijos: solo
--    'scheduled' / 'cancelled' (sin NULL).
--
-- 2. generate_fixed_slot_occurrence: decide y crea UNA ocurrencia dentro de una
--    transacción. Cierra la carrera cron vs. admin:
--    - Toma fixed_slots FOR UPDATE. Un UPDATE is_active=false (baja) espera a
--      este lock, y un INSERT en fixed_slot_exceptions también (su FK toma
--      FOR KEY SHARE sobre la fila padre, que choca con FOR UPDATE). Si la baja
--      o la excepción commitean antes, esta función las ve (cada sentencia
--      plpgsql toma snapshot nuevo en READ COMMITTED). Si commitean después,
--      encuentran el match ya creado y lo cancelan.
--    - pg_advisory_xact_lock por cancha+fecha serializa dos generadores de
--      reglas distintas sobre la misma cancha y día.
--    - Ocupación por rango (misma regla que /[slug]/reservar: match no
--      cancelado, duración NULL/0 => 90) + court_blocks (sin duración propia:
--      se toman 90 min, igual que lib/admin/day-activity.ts).
--    Limitación: las reservas normales no toman estos locks, así que una reserva
--    de jugador simultánea NO queda serializada con el generador.
--
-- 3. deactivate_fixed_slot_atomic: baja permanente todo-o-nada. Si alguna
--    ocurrencia futura (fecha + hora Argentina) tiene dinero registrado, no
--    escribe nada. Si no, desactiva la regla y cancela esas ocurrencias en la
--    misma transacción. Nunca toca campos financieros ni payments.
--
-- Ambas funciones solo son ejecutables por service_role: la autorización del
-- dueño se valida en la server action antes de llamarlas.

create unique index if not exists matches_fixed_slot_occurrence_live_uniq
  on public.matches (fixed_slot_id, scheduled_date)
  where es_turno_fijo = true
    and fixed_slot_id is not null
    and coalesce(match_status, '') <> 'cancelled';

create or replace function public.generate_fixed_slot_occurrence(
  p_fixed_slot_id uuid,
  p_date date,
  p_owner_id uuid,
  p_location_name text,
  p_total_price integer,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_slot public.fixed_slots%rowtype;
  v_now timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_start integer;
  v_end integer;
  v_match_id uuid;
begin
  select * into v_slot from public.fixed_slots where id = p_fixed_slot_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not v_slot.is_active then
    return jsonb_build_object('status', 'inactive');
  end if;
  if extract(dow from p_date)::integer <> v_slot.day_of_week then
    return jsonb_build_object('status', 'wrong_day');
  end if;
  if (p_date + v_slot.start_time) <= v_now then
    return jsonb_build_object('status', 'past');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('fixed_slot_court_day:' || v_slot.court_id::text || ':' || p_date::text, 0)
  );

  if exists (
    select 1 from public.fixed_slot_exceptions e
     where e.fixed_slot_id = p_fixed_slot_id and e.exception_date = p_date
  ) then
    return jsonb_build_object('status', 'exception');
  end if;

  if exists (
    select 1 from public.club_closed_days d
     where d.club_id = v_slot.club_id and d.closed_date = p_date
  ) then
    return jsonb_build_object('status', 'closed_day');
  end if;

  if exists (
    select 1 from public.matches m
     where m.fixed_slot_id = p_fixed_slot_id
       and m.scheduled_date = p_date
       and m.es_turno_fijo = true
       and coalesce(m.match_status, '') <> 'cancelled'
  ) then
    return jsonb_build_object('status', 'exists');
  end if;

  v_start := (extract(epoch from v_slot.start_time)::integer) / 60;
  v_end := v_start + coalesce(nullif(v_slot.duration_minutes, 0), 90);

  if exists (
    select 1 from public.matches m
     where m.court_id = v_slot.court_id
       and m.scheduled_date = p_date
       and m.scheduled_time is not null
       and coalesce(m.match_status, '') <> 'cancelled'
       and (extract(epoch from m.scheduled_time)::integer) / 60 < v_end
       and v_start < (extract(epoch from m.scheduled_time)::integer) / 60
                     + coalesce(nullif(m.duration_minutes, 0), 90)
  ) then
    return jsonb_build_object('status', 'occupied');
  end if;

  if exists (
    select 1 from public.court_blocks b
     where b.court_id = v_slot.court_id
       and (
         (b.blocked_date = p_date and b.blocked_time is not null
           and (extract(epoch from b.blocked_time)::integer) / 60 < v_end
           and v_start < (extract(epoch from b.blocked_time)::integer) / 60 + 90)
         or
         (b.date = p_date
           and (extract(epoch from b.start_time)::integer) / 60 < v_end
           and v_start < (extract(epoch from b.start_time)::integer) / 60 + 90)
       )
  ) then
    return jsonb_build_object('status', 'blocked');
  end if;

  if p_dry_run then
    return jsonb_build_object('status', 'would_create');
  end if;

  if p_owner_id is null then
    return jsonb_build_object('status', 'no_owner');
  end if;

  begin
    insert into public.matches (
      match_type, match_status, payment_status, financial_status,
      total_price, amount_pending, scheduled_date, scheduled_time,
      duration_minutes, court_id, owner_id, location_name, date,
      es_turno_fijo, fixed_slot_id
    ) values (
      'reservation', 'scheduled', 'pending', 'unpaid',
      coalesce(p_total_price, 0), coalesce(p_total_price, 0), p_date, v_slot.start_time,
      coalesce(nullif(v_slot.duration_minutes, 0), 90), v_slot.court_id, p_owner_id, p_location_name,
      p_date + v_slot.start_time,
      true, p_fixed_slot_id
    )
    returning id into v_match_id;
  exception when unique_violation then
    return jsonb_build_object('status', 'exists');
  end;

  return jsonb_build_object('status', 'created', 'match_id', v_match_id);
end;
$$;

revoke execute on function public.generate_fixed_slot_occurrence(uuid, date, uuid, text, integer, boolean) from public;
revoke execute on function public.generate_fixed_slot_occurrence(uuid, date, uuid, text, integer, boolean) from anon;
revoke execute on function public.generate_fixed_slot_occurrence(uuid, date, uuid, text, integer, boolean) from authenticated;
grant execute on function public.generate_fixed_slot_occurrence(uuid, date, uuid, text, integer, boolean) to service_role;

create or replace function public.deactivate_fixed_slot_atomic(p_fixed_slot_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_now timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_ids uuid[];
  v_blocked jsonb;
begin
  perform 1 from public.fixed_slots where id = p_fixed_slot_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Ocurrencias futuras reales (fecha + hora AR), bloqueadas para que un cobro
  -- concurrente espere a esta transacción. Un INSERT en payments también espera:
  -- su FK toma FOR KEY SHARE sobre el match.
  select coalesce(array_agg(s.id), '{}') into v_ids
    from (
      select m.id from public.matches m
       where m.fixed_slot_id = p_fixed_slot_id
         and m.es_turno_fijo = true
         and coalesce(m.match_status, '') <> 'cancelled'
         and m.scheduled_date is not null
         and m.scheduled_time is not null
         and (m.scheduled_date + m.scheduled_time) > v_now
       for update
    ) s;

  select coalesce(jsonb_agg(jsonb_build_object(
           'scheduled_date', m.scheduled_date,
           'scheduled_time', to_char(m.scheduled_time, 'HH24:MI'),
           'financial_status', m.financial_status,
           'payment_status', m.payment_status
         ) order by m.scheduled_date, m.scheduled_time), '[]'::jsonb)
    into v_blocked
    from public.matches m
   where m.id = any(v_ids)
     and (
       coalesce(m.amount_paid, 0) > 0
       or m.payment_status = 'paid'
       or m.financial_status in ('partially_paid', 'fully_paid')
       or exists (select 1 from public.payments p where p.match_id = m.id and p.status = 'approved')
     );

  if jsonb_array_length(v_blocked) > 0 then
    return jsonb_build_object('status', 'has_money', 'blocked', v_blocked);
  end if;

  update public.fixed_slots set is_active = false where id = p_fixed_slot_id;

  update public.matches set match_status = 'cancelled' where id = any(v_ids);

  return jsonb_build_object('status', 'ok', 'cancelled_match_ids', to_jsonb(v_ids));
end;
$$;

revoke execute on function public.deactivate_fixed_slot_atomic(uuid) from public;
revoke execute on function public.deactivate_fixed_slot_atomic(uuid) from anon;
revoke execute on function public.deactivate_fixed_slot_atomic(uuid) from authenticated;
grant execute on function public.deactivate_fixed_slot_atomic(uuid) to service_role;
