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
security invoker
as $$
declare
  v_owner uuid;
  v_court_id uuid;
  v_scheduled_date date;
  v_scheduled_time time;
  v_count int;
  v_new_owner uuid;
begin
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
