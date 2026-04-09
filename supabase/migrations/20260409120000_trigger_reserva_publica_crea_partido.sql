-- Al insertar una reserva pública, crea un partido en el feed con los mismos
-- fecha, hora y pista_id.
--
-- Requisitos: columnas is_public (boolean), fecha, hora, pista_id en reservas;
-- mismas columnas (al menos) en partidos. Si partidos tiene NOT NULL sin default
-- (ej. club_id, usuario_id), ampliá el INSERT en el cuerpo de la función.

CREATE OR REPLACE FUNCTION public.trg_reserva_publica_inserta_partido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.partidos (fecha, hora, pista_id)
  VALUES (NEW.fecha, NEW.hora, NEW.pista_id);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_reserva_publica_inserta_partido() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_reservas_publica_crea_partido ON public.reservas;

CREATE TRIGGER trg_reservas_publica_crea_partido
  AFTER INSERT ON public.reservas
  FOR EACH ROW
  WHEN (NEW.is_public IS TRUE)
  EXECUTE FUNCTION public.trg_reserva_publica_inserta_partido();

COMMENT ON FUNCTION public.trg_reserva_publica_inserta_partido() IS
  'Inserta fila en partidos cuando reservas.is_public es true (feed social).';
