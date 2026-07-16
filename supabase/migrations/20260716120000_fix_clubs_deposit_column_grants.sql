-- fix: deposit_type/deposit_value se agregaron en 20260714120000_clubs_deposit_config.sql
-- pero nunca se sumaron al allowlist de columnas de 20260713130000_fix_clubs_billing_column_grants.sql,
-- que reemplazo el GRANT a nivel de tabla por uno a nivel de columna. Como PostgREST
-- rechaza el select completo si falta el grant de una sola columna, cualquier query
-- que pida deposit_type/deposit_value (crear-partido, reservas, etc.) fallaba con
-- "permission denied for table clubs".
grant select (deposit_type, deposit_value) on public.clubs to anon, authenticated;
