-- ═══════════════════════════════════════════════════════════════════════
-- TELÉFONO DECLARADO POR EL JUGADOR (sin OTP)
--
-- Requiere 20260929100000_profiles_protected_columns.sql (ya aplicada). No la
-- modifica ni afloja sus grants: phone, onboarding_completed,
-- is_globally_blocked, id y user_id siguen sin ser escribibles desde la sesión.
--
-- CAMBIO DE DECISIÓN: PadeLibre no verifica la propiedad del teléfono (no hay
-- proveedor SMS/WhatsApp). El jugador ingresa un celular argentino, la app lo
-- normaliza con libphonenumber (lib/phone-ar.ts) y el jugador confirma que es
-- correcto. Eso NO prueba propiedad: el número es "declarado", no verificado.
--
--   1. complete_player_onboarding() deja de leer auth.users y recibe p_phone.
--      Se reemplaza la firma de 10 parámetros (única vía anterior, exigía
--      phone_confirmed_at) por una de 11. Sigue siendo el ÚNICO camino de
--      sesión que escribe onboarding_completed.
--   2. update_my_phone(): único camino de sesión para corregir el teléfono
--      después del onboarding. Solo la fila propia y solo la columna phone.
--
-- Ambas funciones:
--   - exigen auth.uid() y actúan solo sobre where user_id = auth.uid();
--   - validan el formato E.164 de celular argentino (+549 + 10 dígitos) y
--     rechazan abonados con 7 dígitos finales iguales, igual que el cliente;
--   - no tocan auth.users (ni phone ni phone_confirmed_at), is_globally_blocked,
--     id ni user_id;
--   - search_path vacío y EXECUTE solo para authenticated.
--
-- NO modifica datos existentes: los perfiles ya registrados conservan su
-- phone y onboarding_completed tal cual.
-- ═══════════════════════════════════════════════════════════════════════

drop function if exists public.complete_player_onboarding(
  text, integer, text, text, text, text, text, text, text, text
);

create or replace function public.complete_player_onboarding(
  p_name text,
  p_age integer,
  p_gender text,
  p_avatar_url text,
  p_preferred_hand text,
  p_court_position text,
  p_preferred_schedule text,
  p_category text,
  p_phone text,
  p_province text,
  p_city text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := btrim(coalesce(p_phone, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if coalesce(btrim(p_name), '') = ''
     or length(p_name) > 120
     or p_gender is null or p_gender not in ('masculino', 'femenino')
     or p_preferred_hand is null or p_preferred_hand not in ('derecha', 'izquierda', 'ambas')
     or p_court_position is null or p_court_position not in ('drive', 'reves', 'ambas')
     or p_preferred_schedule is null or p_preferred_schedule not in ('manana', 'tarde', 'noche', 'cualquiera')
     or p_category is null or p_category not in ('1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va')
     or coalesce(btrim(p_province), '') = ''
     or length(p_province) > 80
     or length(coalesce(p_city, '')) > 80
     or length(coalesce(p_avatar_url, '')) > 2048
     or (p_age is not null and (p_age < 1 or p_age > 119)) then
    raise exception 'invalid_profile' using errcode = '22023';
  end if;

  if v_phone !~ '^\+549[1-9][0-9]{9}$'
     or translate(right(v_phone, 7), right(v_phone, 1), '') = '' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  update public.profiles
     set name = btrim(p_name),
         age = p_age,
         gender = p_gender,
         avatar_url = nullif(btrim(coalesce(p_avatar_url, '')), ''),
         preferred_hand = p_preferred_hand,
         court_position = p_court_position,
         preferred_schedule = p_preferred_schedule,
         category = p_category,
         province = btrim(p_province),
         city = nullif(btrim(coalesce(p_city, '')), ''),
         phone = v_phone,
         onboarding_completed = true
   where user_id = v_uid
     and coalesce(onboarding_completed, false) = false;

  if not found then
    raise exception 'onboarding_unavailable' using errcode = 'P0001';
  end if;

  return v_phone;
end;
$$;

revoke all on function public.complete_player_onboarding(
  text, integer, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.complete_player_onboarding(
  text, integer, text, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.update_my_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := btrim(coalesce(p_phone, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_phone !~ '^\+549[1-9][0-9]{9}$'
     or translate(right(v_phone, 7), right(v_phone, 1), '') = '' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  -- Durante el onboarding el teléfono lo escribe complete_player_onboarding().
  update public.profiles
     set phone = v_phone
   where user_id = v_uid
     and coalesce(onboarding_completed, false) = true;

  if not found then
    raise exception 'profile_unavailable' using errcode = 'P0001';
  end if;

  return v_phone;
end;
$$;

revoke all on function public.update_my_phone(text) from public, anon;
grant execute on function public.update_my_phone(text) to authenticated;
