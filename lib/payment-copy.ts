/** Copy único para flujos de pago (partidos / MP). */

export const PAYMENT_COPY = {
  approvedTitle: "¡Listo! Ya tenés tu lugar",
  approvedBody:
    "Cuando los cuatro jugadores completen el pago, les avisamos por acá y por notificación. Mientras tanto podés ir al chat del partido.",
  pendingTitle: "Estamos verificando tu pago",
  pendingBody: "Suele tardar menos de un minuto. Si sigue igual, actualizá la página en un rato.",
  pendingSlow: "Está tardando más de lo esperado. Te avisamos cuando se confirme; podés volver al partido.",
  failureTitle: "El pago no se pudo completar",
  failureBody: "Probá con otro medio o reintentá. Si el problema sigue, escribinos desde Ayuda.",
  expiredTitle: "El link de pago venció",
  expiredBody: "Generá uno nuevo desde el partido; no te cobramos dos veces hasta que confirmes.",
  regenerateCta: "Generar nuevo link de pago",
  retryCta: "Reintentar pago",
  backToMatch: "Volver al partido",
  openChat: "Ir al chat del partido",
  yourPayment: "Tu pago",
  matchStatus: "El partido",
  youPaidApproved: "Confirmado — ya entraste al partido con tu pago.",
  youPaidPending: "Pendiente — en cuanto MP confirme, te mostramos el check.",
  youPaidRejected: "No se procesó. Podés reintentar con otro medio.",
  matchWaitingPlayers: "Esperando que paguen los 4 jugadores.",
  matchReserved: "Los pagos están completos — turno confirmado para el club.",
  matchAllConfirmed: "¡Partido confirmado! Los 4 jugadores están anotados.",
} as const;
