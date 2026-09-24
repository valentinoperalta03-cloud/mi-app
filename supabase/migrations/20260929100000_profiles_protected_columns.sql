-- ═══════════════════════════════════════════════════════════════════════
-- SEGURIDAD — columnas protegidas de public.profiles
--
-- ESTADO EN PRODUCCIÓN (leído sin escribir, 2026-09-24):
--   - anon y authenticated tienen INSERT/UPDATE sobre la TABLA completa.
--   - Varias políticas UPDATE permisivas: (auth.uid() = user_id) y
--     (auth.uid() = id). Ninguna restringe columnas y no hay triggers.
--   => Un jugador logueado puede, con la clave anon pública y su JWT:
--      * poner onboarding_completed = true sin pasar por el onboarding,
--      * cambiar phone por cualquier número sin verificarlo,
--      * poner is_globally_blocked = false y desbloquearse solo,
--      * cambiar user_id de su fila (la política por `id` no lo impide).
--
-- DISEÑO:
--   1. Permisos por columna: se revoca INSERT/UPDATE de tabla y se
--      re-otorga solo sobre las columnas que el cliente de sesión escribe
--      hoy (grep de todos los .insert/.update/.upsert sobre profiles).
--      Quedan fuera: onboarding_completed, phone, is_globally_blocked, id,
--      user_id (UPDATE). service_role y las funciones SECURITY DEFINER
--      (handle_new_user) no pasan por estos grants: no cambian.
--   2. Camino autorizado: public.complete_player_onboarding(). Es la ÚNICA
--      vía de sesión que escribe phone y onboarding_completed. El teléfono
--      NO es un parámetro: se lee de auth.users (phone + phone_confirmed_at)
--      de auth.uid(). Sin OTP confirmado en Supabase Auth, falla. Solo
--      actúa sobre la fila del propio usuario.
--
-- NO modifica datos: los 255 perfiles existentes (phone, onboarding) quedan
-- como están. NO toca auth.users.
--
-- Columnas nuevas agregadas en el futuro a profiles NO serán escribibles
-- desde la sesión hasta que se otorguen explícitamente acá.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Permisos por columna ────────────────────────────────────────────────
revoke insert, update on public.profiles from anon, authenticated;

-- anon nunca escribe profiles (las políticas exigen auth.uid()).
-- authenticated: filas nuevas solo con identidad y nombre
-- (lib/profiles.ts, app/admin/reservas/actions.ts, lib/fixed-slot-generator.ts).
grant insert (id, user_id, name) on public.profiles to authenticated;

-- Edición legítima del propio perfil (perfil/editar, ajustes, home,
-- locations, onesignal). Sin phone, onboarding_completed,
-- is_globally_blocked, id ni user_id.
grant update (
  name, age, bio, description, gender, avatar_url,
  preferred_hand, court_position, preferred_schedule, category,
  country, province, city, location,
  notifications_enabled, is_public, slides_seen, onesignal_player_id
) on public.profiles to authenticated;

-- 2) Finalización autorizada del onboarding ──────────────────────────────
create or replace function public.complete_player_onboarding(
  p_name text,
  p_age integer,
  p_gender text,
  p_avatar_url text,
  p_preferred_hand text,
  p_court_position text,
  p_preferred_schedule text,
  p_category text,
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
  v_auth_phone text;
  v_confirmed_at timestamptz;
  v_phone text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if coalesce(btrim(p_name), '') = ''
     or p_gender not in ('masculino', 'femenino')
     or p_preferred_hand not in ('derecha', 'izquierda', 'ambas')
     or p_court_position not in ('drive', 'reves', 'ambas')
     or p_preferred_schedule not in ('manana', 'tarde', 'noche', 'cualquiera')
     or p_category not in ('1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va')
     or coalesce(btrim(p_province), '') = ''
     or (p_age is not null and (p_age < 1 or p_age > 119)) then
    raise exception 'invalid_profile' using errcode = '22023';
  end if;

  -- Fuente de verdad: el teléfono confirmado por OTP en Supabase Auth.
  -- Un phone_change pendiente vive en auth.users.phone_change y no cuenta.
  select u.phone, u.phone_confirmed_at
    into v_auth_phone, v_confirmed_at
    from auth.users u
   where u.id = v_uid;

  if v_confirmed_at is null or coalesce(v_auth_phone, '') = '' then
    raise exception 'phone_not_verified' using errcode = 'P0001';
  end if;

  v_phone := '+' || regexp_replace(v_auth_phone, '\D', '', 'g');

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
  text, integer, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.complete_player_onboarding(
  text, integer, text, text, text, text, text, text, text, text
) to authenticated;
