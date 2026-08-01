/**
 * Microcopy unificado — tono argentino, voseo, concreto.
 *
 * - Voseo: tenés, podés, hacé, elegí.
 * - Cercano, no bancario.
 * - Sin tecnicismos ni error.message al usuario.
 * - Banners máx. 2 líneas; toasts 1 línea.
 */

export const EDIT_ERROR_MESSAGES: Record<string, string> = {
  datos: "Faltan datos para guardar los cambios.",
  duracion: "Duración del turno inválida.",
  permiso: "No tenés permiso para editar este partido.",
  pagado: "No podés editar un partido con jugadores que ya pagaron.",
  fecha: "No se encontró la fecha del partido.",
  ocupado: "Ese horario ya está ocupado. Elegí otro.",
  db: "No se pudieron guardar los cambios. Intentá de nuevo.",
};

export const JOIN_FLASH_MESSAGES: Record<string, string> = {
  sent: "Solicitud enviada. El creador del partido puede aceptarte desde el detalle del partido.",
  error: "No se pudo enviar la solicitud. Intentá de nuevo.",
  permiso: "No tenés permiso para esa acción.",
  cupos: "Llegamos tarde, ya se completó este partido. Buscá otro abierto.",
  nivel: "Tu nivel no es compatible con este partido.",
  genero_femenino: "Este partido es solo femenino.",
  genero_masculino: "Este partido es solo masculino.",
  db: "Algo salió mal al guardar. Intentá de nuevo.",
  pago: "No pudimos abrir Mercado Pago. Intentá de nuevo en un rato.",
  equipo: "Elegí equipo 1 o 2 antes de unirte.",
  equipo_lleno: "Ese equipo ya tiene 2 jugadores. Elegí el otro.",
  rate_limit: "Estás intentando unirte a muchos partidos muy rápido. Probá de nuevo en un rato.",
};

export const CANCEL_ERROR_MESSAGES: Record<string, string> = {
  no_match: "No encontramos el partido.",
  no_cupo: "No estabas anotado en este partido.",
  finalizado: "Este partido ya no admite cambios.",
  rpc: "No pudimos liberar tu lugar. Intentá de nuevo.",
  rate_limit: "Alcanzaste el límite de 5 cancelaciones en 30 días. Contactá soporte si es un error.",
};
