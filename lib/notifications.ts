import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationType =
  | "join_request"
  | "join_approved"
  | "join_rejected"
  | "player_joined"
  | "match_reminder"
  | "result_pending"
  | "match_result"
  | "reservation_confirmed"
  | "reservation_cancelled"
  | "payment_approved"
  | "payment_rejected"
  | "level_up"
  | "match_cancelled"
  | "match_owner_changed"
  | "new_follower"
  | "now_friends"
  | "new_message"
  | "group_message"
  | "added_to_group"
  | "tournament_event"
  | "club_agenda";

export async function createNotification(
  supabase: SupabaseClient,
  params: {
    user_id: string;
    type: NotificationType;
    title: string;
    body: string;
    match_id?: string;
    actor_id?: string;
  }
) {
  // 1. Guardar en base de datos (in-app)
  await supabase.from("notifications").insert({
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    body: params.body,
    match_id: params.match_id ?? null,
    actor_id: params.actor_id ?? null,
  });

  // 2. Disparar push externo (OneSignal)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.padelibre.online";
    await fetch(`${baseUrl}/api/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: params.user_id,
        title: params.title,
        body: params.body,
        match_id: params.match_id,
      }),
    });
  } catch (err) {
    console.error("Push notification error:", err);
  }
}

export const NOTIFICATION_TEMPLATES = {
  join_request: (requesterName: string) => ({
    title: "Nueva solicitud de acceso",
    body: `${requesterName} quiere unirse a tu partido.`,
  }),
  join_approved: (matchInfo: string) => ({
    title: "¡Solicitud aprobada!",
    body: `Tu solicitud para unirte al partido en ${matchInfo} fue aprobada.`,
  }),
  join_rejected: (matchInfo: string) => ({
    title: "Solicitud rechazada",
    body: `Tu solicitud para unirte al partido en ${matchInfo} fue rechazada.`,
  }),
  player_joined: (playerName: string, matchInfo: string) => ({
    title: "Nuevo jugador en tu partido",
    body: `${playerName} se unió al partido en ${matchInfo}.`,
  }),
  match_reminder: (matchInfo: string, time: string) => ({
    title: "¡Tu partido es hoy!",
    body: `Recordatorio: tenés un partido en ${matchInfo} a las ${time}.`,
  }),
  result_pending: (matchInfo: string) => ({
    title: "Resultado pendiente de confirmar",
    body: `Confirmá el resultado del partido en ${matchInfo}.`,
  }),
  reservation_confirmed: (courtName: string, date: string, time: string) => ({
    title: "Reserva confirmada ✓",
    body: `Tu reserva en ${courtName} el ${date} a las ${time} está confirmada.`,
  }),
  reservation_cancelled: (courtName: string) => ({
    title: "Reserva cancelada",
    body: `Tu reserva en ${courtName} fue cancelada.`,
  }),
  payment_approved: (amount: string) => ({
    title: "Pago aprobado ✓",
    body: `Tu pago de $${amount} fue procesado correctamente.`,
  }),
  payment_rejected: () => ({
    title: "Pago rechazado",
    body: "Tu pago no pudo procesarse. Intentá con otro medio de pago.",
  }),
  match_cancelled: (matchInfo: string) => ({
    title: "Partido cancelado",
    body: `El partido en ${matchInfo} fue cancelado.`,
  }),
  match_owner_changed: (matchInfo: string) => ({
    title: "Nuevo organizador asignado",
    body: `Ahora sos el organizador del partido en ${matchInfo}.`,
  }),
  level_up: (newLevel: string) => ({
    title: "¡Subiste de nivel! 🎾",
    body: `Tu nuevo nivel es ${newLevel}. ¡Seguí así!`,
  }),
};
