-- Compatibilidad de transicion para confirmed_at (20260915130000).
--
-- Un amistoso que ya estaba en 'full' antes de que join_match_atomic empezara a
-- estampar confirmed_at quedaria con confirmed_at NULL. Si despues baja a
-- 'scheduled' (leave_match_atomic, 20260915140000) se pierde la unica evidencia
-- de que estuvo confirmado, y los crons lo cancelarian sin aplicar la politica.
--
-- Este backfill registra SOLO EL HECHO de la confirmacion para los partidos que
-- estan en 'full' al aplicar la migracion. El valor now() NO es la hora real de
-- confirmacion (esa hora no existe en la base): marca el momento en que se
-- constato que el partido estaba confirmado, y es siempre posterior a la
-- confirmacion real. La politica de cancelacion usa confirmed_at como booleano
-- (la ventana se mide contra scheduled_date/scheduled_time), asi que este valor
-- no altera ningun calculo.
--
-- Alcance deliberadamente minimo:
--   * solo amistosos: las reservas confirmadas se reconocen por el pago aprobado
--     y por match_status 'reserved', que no retrocede;
--   * solo 'full' actual: un partido 'scheduled' o 'cancelled' no permite saber
--     si alguna vez tuvo 4 jugadores, y marcarlo cobraria a quien nunca confirmo;
--   * solo filas sin confirmed_at: idempotente, no pisa marcas reales.
update public.matches
set confirmed_at = now()
where lower(coalesce(match_type, '')) = 'amistoso'
  and lower(coalesce(match_status, '')) = 'full'
  and confirmed_at is null;
