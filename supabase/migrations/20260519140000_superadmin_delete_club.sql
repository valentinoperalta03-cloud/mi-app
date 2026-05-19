-- Eliminación atómica de un club y sus datos dependientes (solo service_role vía RPC).
create or replace function public.superadmin_delete_club(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_court_ids uuid[];
  v_match_ids uuid[];
  v_group_ids uuid[];
begin
  if p_club_id is null then
    raise exception 'club_id requerido';
  end if;

  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'club no encontrado';
  end if;

  select coalesce(array_agg(id), '{}') into v_court_ids
  from public.courts
  where club_id = p_club_id;

  if cardinality(v_court_ids) > 0 then
    select coalesce(array_agg(id), '{}') into v_match_ids
    from public.matches
    where court_id = any (v_court_ids);

    if cardinality(v_match_ids) > 0 then
      select coalesce(array_agg(id), '{}') into v_group_ids
      from public.group_chats
      where match_id = any (v_match_ids);

      if cardinality(v_group_ids) > 0 then
        delete from public.group_chat_messages where group_id = any (v_group_ids);
        delete from public.group_chat_members where group_id = any (v_group_ids);
        delete from public.group_chats where id = any (v_group_ids);
      end if;

      delete from public.match_players where match_id = any (v_match_ids);
      delete from public.level_evolution where match_id = any (v_match_ids);
      delete from public.matches where id = any (v_match_ids);
    end if;

    delete from public.courts where id = any (v_court_ids);
  end if;

  delete from public.clubs where id = p_club_id;
end;
$$;

revoke all on function public.superadmin_delete_club(uuid) from public;
grant execute on function public.superadmin_delete_club(uuid) to service_role;
