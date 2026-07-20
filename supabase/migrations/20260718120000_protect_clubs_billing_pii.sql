-- Vulnerabilidad critica: mp_access_token, mp_user_id y finance_pin de
-- public.clubs tenian GRANT SELECT/UPDATE a anon y authenticated (ver
-- 20260713130000_fix_clubs_billing_column_grants.sql). Con la anon key
-- publica, cualquiera podia leer el token OAuth de MP de cualquier club
-- (GET /rest/v1/clubs?select=mp_access_token,mp_user_id,finance_pin) y
-- suplantar el cobro del club, ademas de leer/forzar el PIN de finanzas.
--
-- Fix: revocar esas 3 columnas para anon/authenticated (quedan solo para
-- service_role, mismo patron que subscription_status). El codigo de la app
-- que necesitaba leerlas via cliente de sesion se migro a service client;
-- los usos que solo necesitaban un booleano derivado ahora usan las 2
-- funciones SECURITY DEFINER de abajo, que nunca devuelven el secreto.
revoke select (mp_access_token, mp_user_id, finance_pin) on public.clubs from anon, authenticated;
revoke update (mp_access_token, mp_user_id, finance_pin) on public.clubs from anon, authenticated;

-- Booleano de conexion MP por club (mismo shape que get_clubs_availability).
create or replace function get_clubs_mp_connected()
returns table (club_id uuid, mp_connected boolean)
language sql
security definer
set search_path = public
as $$
  select
    id as club_id,
    (mp_access_token is not null and btrim(mp_access_token) <> ''
      and mp_user_id is not null and btrim(mp_user_id) <> '') as mp_connected
  from clubs
  where is_active = true;
$$;

grant execute on function get_clubs_mp_connected() to authenticated, anon;

-- Verifica el PIN de finanzas en Postgres sin devolver el valor real al
-- cliente. Si el club no configuro finance_pin, el default operativo es
-- "1234" (mismo fallback que ya usaba el codigo del lado del cliente).
create or replace function verify_finance_pin(p_club_id uuid, p_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clubs
    where id = p_club_id
      and coalesce(nullif(btrim(finance_pin), ''), '1234') = p_pin
  );
$$;

grant execute on function verify_finance_pin(uuid, text) to authenticated;
