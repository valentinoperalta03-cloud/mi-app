-- Marca explicita de "esta cancelacion genero saldo por politica".
--
-- /admin/cobros no puede deducir una deuda de amount_pending: un amistoso nace
-- con amount_pending = total_price, y ese valor se conserva cuando el partido se
-- cancela sin cargo (el club lo cancela, o se vacia porque todos se bajan:
-- leave_match_atomic no toca los campos financieros de amistosos). Un amistoso
-- confirmado cancelado por esos caminos quedaria cancelled + confirmed_at +
-- amount_pending > 0 y apareceria como deuda sin serlo.
--
-- late_cancellation_at se setea SOLO en las cancelaciones que aplican la
-- politica (jugador u organizador fuera de termino, o cron por incompleto de un
-- partido confirmado). Nunca en cancelaciones del club ni en bajas individuales.
-- matches tiene grants a nivel de tabla: la columna los hereda.
alter table public.matches
  add column if not exists late_cancellation_at timestamptz;

comment on column public.matches.late_cancellation_at is
  'Momento de una cancelacion fuera de termino que dejo saldo a cobrar por politica. NULL en toda cancelacion sin cargo.';
