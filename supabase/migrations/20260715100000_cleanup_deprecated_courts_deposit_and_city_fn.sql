-- Limpieza de esquema obsoleto:
-- 1) get_matches_by_city calculaba total_price * 1.05 / 4 (comision de servicio
--    del modelo viejo). Sin callers en el codigo TypeScript; se dropea junto
--    con su grant a authenticated.
-- 2) courts.requires_deposit/deposit_type/deposit_value fueron reemplazadas por
--    clubs.deposit_type/deposit_value (ver 20260714120000_clubs_deposit_config.sql).
--    Sin lectores/escritores en el codigo; se eliminan las columnas.

revoke execute on function public.get_matches_by_city(text) from authenticated;
drop function if exists public.get_matches_by_city(text);

alter table public.courts
  drop column if exists requires_deposit,
  drop column if exists deposit_type,
  drop column if exists deposit_value;
