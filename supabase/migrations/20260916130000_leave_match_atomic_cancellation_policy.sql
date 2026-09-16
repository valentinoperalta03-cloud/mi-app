-- leave_match_atomic: cuando el organizador sale último de un AMISTOSO y el
-- partido se cancela, aplica la política de cancelación del club dentro de la
-- misma transacción. Antes esa rama cancelaba sin evaluar confirmed_at ni la
-- ventana, así que un partido confirmado (llegó a 4) podía vaciarse jugador por
-- jugador y cancelarse 2 h antes sin saldo a cobrar. La RPC está expuesta a
-- authenticated: arreglar solo cancelParticipation dejaba el bypass abierto.
--
-- La regla replica EXACTAMENTE cancelOpenMatch + lib/cancellation-policy.ts:
--   - Confirmado = confirmed_at not null, o estado 'full'/'reserved' al entrar
--     (isBookingConfirmed). Nunca confirmado => nunca tardío.
--   - Ventana = clubs.cancellation_hours si es preset (0,2,6,12,24,48), si no 24
--     (resolveCancellationHours).
--   - Tardío = hours <= 0, o faltan MENOS de hours*60 minutos. El borde exacto
--     es a tiempo (isLateCancellation).
--   - Inicio del turno = scheduled_date + scheduled_time en hora Argentina
--     (utcMsForArgentinaWallClock).
--   - Tardío con total > 0: amount_paid = least(greatest(paid,0), total),
--     amount_pending = total - paid, late_cancellation_at (lateCancellationFinancials).
--     Total <= 0: no se tocan los campos financieros.
--   - A tiempo: amount_paid se conserva, amount_pending = 0 (onTimeCancellationFinancials).
--   - payment_status del amistoso nunca se toca (cancelar != devolver).
--
-- Idempotencia: la cancelación solo corre cuando el participante existía (el
-- delete lanza participant_not_found si no) y el partido NO estaba cancelado
-- al entrar. Un partido ya cancelado (por cancelOpenMatch, el club o un cron)
-- conserva sus campos: no se recalcula deuda ni se pisa late_cancellation_at.
-- El saldo siempre se deriva de total - amount_paid, nunca se acumula.
--
-- Reservas (match_type <> 'amistoso') mantienen el comportamiento anterior.
-- Firma, retorno y grants idénticos a 20260915190000.

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
  v_match_type text;
  v_status_before text;
  v_confirmed_at timestamptz;
  v_total numeric;
  v_paid numeric;
  v_hours_raw int;
  v_hours int;
  v_late boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() is distinct from p_player_id then
      raise exception 'forbidden';
    end if;
  end if;

  select m.owner_id, m.court_id, m.scheduled_date, m.scheduled_time,
         lower(coalesce(m.match_type, '')), lower(coalesce(m.match_status, '')),
         m.confirmed_at, m.total_price, m.amount_paid
  into v_owner, v_court_id, v_scheduled_date, v_scheduled_time,
       v_match_type, v_status_before,
       v_confirmed_at, v_total, v_paid
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

  -- El cupo dejo de estar completo: el partido vuelve a buscar jugadores.
  -- Solo revierte 'full'; no toca 'reserved', 'cancelled' ni 'scheduled'.
  -- confirmed_at se conserva.
  if v_count < 4 then
    update public.matches m
    set match_status = 'scheduled'
    where m.id = p_match_id
      and lower(coalesce(m.match_status, '')) = 'full';
  end if;

  if v_owner = p_player_id then
    if v_count = 0 then
      if v_match_type = 'amistoso' and v_status_before <> 'cancelled' then
        if (v_confirmed_at is not null or v_status_before in ('full', 'reserved'))
           and v_scheduled_date is not null
           and v_scheduled_time is not null then
          select c.cancellation_hours into v_hours_raw
          from public.courts co
          join public.clubs c on c.id = co.club_id
          where co.id = v_court_id;

          v_hours := case when v_hours_raw in (0, 2, 6, 12, 24, 48) then v_hours_raw else 24 end;

          v_late := v_hours <= 0
            or ((v_scheduled_date + v_scheduled_time) at time zone 'America/Argentina/Buenos_Aires')
               - now() < make_interval(hours => v_hours);
        end if;

        if v_late and coalesce(v_total, 0) > 0 then
          update public.matches m
          set match_status = 'cancelled',
              amount_paid = least(greatest(coalesce(m.amount_paid, 0), 0), v_total),
              amount_pending = greatest(v_total - least(greatest(coalesce(m.amount_paid, 0), 0), v_total), 0),
              financial_status = case
                when least(greatest(coalesce(m.amount_paid, 0), 0), v_total) <= 0 then 'unpaid'
                when least(greatest(coalesce(m.amount_paid, 0), 0), v_total) >= v_total then 'fully_paid'
                else 'partially_paid'
              end,
              late_cancellation_at = coalesce(m.late_cancellation_at, now())
          where m.id = p_match_id;
        elsif v_late then
          -- Sin precio no se puede derivar saldo: se cancela sin tocar dinero.
          update public.matches m
          set match_status = 'cancelled'
          where m.id = p_match_id;
        else
          update public.matches m
          set match_status = 'cancelled',
              amount_paid = greatest(coalesce(m.amount_paid, 0), 0),
              amount_pending = 0,
              financial_status = case
                when greatest(coalesce(m.amount_paid, 0), 0) <= 0 then 'unpaid'
                when greatest(coalesce(m.amount_paid, 0), 0) >= greatest(coalesce(v_total, 0), 0) then 'fully_paid'
                else 'partially_paid'
              end
          where m.id = p_match_id;
        end if;
      elsif v_match_type = 'amistoso' then
        -- Ya estaba cancelado: no se recalcula nada financiero.
        update public.matches m
        set match_status = 'cancelled'
        where m.id = p_match_id;
      else
        update public.matches m
        set match_status = 'cancelled',
            payment_status = 'cancelled'
        where m.id = p_match_id;
      end if;

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

revoke execute on function public.leave_match_atomic(uuid, uuid) from public;
revoke execute on function public.leave_match_atomic(uuid, uuid) from anon;
grant execute on function public.leave_match_atomic(uuid, uuid) to authenticated, service_role;
