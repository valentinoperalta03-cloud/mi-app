import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { getMercadoPagoPaymentStatus, refundMercadoPagoPayment } from "@/lib/mercadopago";

export type PaymentRefundOutcome =
  | { kind: "refunded" }
  /** No hay nada que reembolsar por MP: pago offline (efectivo/transferencia), ya reembolsado o sin fila. */
  | { kind: "not_applicable" }
  | { kind: "failed" }
  /**
   * MP confirmó el reembolso (la plata YA salió) pero el UPDATE local de
   * `payments.status = "refunded"` falló. Kind separado de "failed" a
   * propósito: un caller que trate esto como "failed" genérico y reintente
   * puede volver a llamar a Mercado Pago para un pago que ya no existe del
   * lado de MP. El caller debe mostrar error y pedir reconciliación manual,
   * nunca reintentar el refund.
   */
  | { kind: "refunded_unsynced"; message: string };

/**
 * Busca el token de Mercado Pago del club dueño del match (match → court →
 * club → mp_access_token), leido con service_role porque la columna esta
 * revocada para anon/authenticated.
 */
export async function getClubAccessTokenForMatch(
  admin: SupabaseClient,
  matchId: string
): Promise<string | null> {
  const { data: matchRow } = await admin
    .from(DB_TABLES.matches)
    .select("court_id")
    .eq("id", matchId)
    .maybeSingle();
  const courtId = String((matchRow as { court_id?: string | null } | null)?.court_id ?? "").trim();
  if (!courtId) return null;

  const { data: courtRow } = await admin
    .from(DB_TABLES.courts)
    .select("club_id")
    .eq("id", courtId)
    .maybeSingle();
  const clubId = String((courtRow as { club_id?: string | null } | null)?.club_id ?? "").trim();
  if (!clubId) return null;

  const { data: clubRow } = await admin
    .from(DB_TABLES.clubs)
    .select("mp_access_token")
    .eq("id", clubId)
    .maybeSingle();
  return (clubRow as { mp_access_token?: string | null } | null)?.mp_access_token ?? null;
}

/**
 * Reembolsa una fila puntual de `payments` si tiene un pago de Mercado Pago
 * real pendiente de reembolsar (`status` approved o refund_requested —este
 * ultimo cubre el backlog del modelo viejo que solo prometia el reembolso—,
 * `payment_method` mercadopago y `mp_payment_id` presente). Es el mismo
 * `refundMercadoPagoPayment` que usa el jugador al cancelar su reserva.
 */
export async function refundApprovedPayment(
  admin: SupabaseClient,
  paymentId: string
): Promise<PaymentRefundOutcome> {
  const { data: row } = await admin
    .from(DB_TABLES.payments)
    .select("id, match_id, status, mp_payment_id, payment_method")
    .eq("id", paymentId)
    .maybeSingle();
  const p = row as {
    id: string;
    match_id: string | null;
    status: string | null;
    mp_payment_id: string | null;
    payment_method: string | null;
  } | null;
  if (!p) return { kind: "not_applicable" };
  if (p.status !== "approved" && p.status !== "refund_requested") return { kind: "not_applicable" };
  if (p.payment_method && p.payment_method !== "mercadopago") return { kind: "not_applicable" };
  const mpId = String(p.mp_payment_id ?? "").trim();
  if (!mpId) return { kind: "not_applicable" };
  const matchId = String(p.match_id ?? "").trim();
  const clubAccessToken = matchId ? await getClubAccessTokenForMatch(admin, matchId) : null;
  if (!clubAccessToken) return { kind: "failed" };

  let claimedNow = false;
  if (p.status === "approved") {
    // CLAIM ATÓMICO: approved -> refund_requested condicionado por
    // WHERE status = 'approved'. Esto —no la idempotency key del SDK, que
    // queda como defensa secundaria (ver lib/mercadopago.ts)— es lo que
    // garantiza que, ante dos requests concurrentes sobre el MISMO payment
    // "approved", solo UNO llegue a ejecutar el POST /refunds: Postgres
    // resuelve el UPDATE condicionado como una operación atómica a nivel
    // fila, así que el segundo request que intente el mismo UPDATE después
    // de que el primero ya corrió afecta 0 filas — no hay ventana en la que
    // ambos puedan "ganar".
    const { data: claimedRows, error: claimErr } = await admin
      .from(DB_TABLES.payments)
      .update({ status: "refund_requested", updated_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("status", "approved")
      .select("id");
    if (claimErr) {
      // No se pudo ni intentar el claim: fail closed, nunca se llama a MP.
      return { kind: "failed" };
    }
    claimedNow = (claimedRows?.length ?? 0) > 0;
  }

  if (!claimedNow) {
    // O perdimos la carrera del claim atómico (otro request lo tomó primero
    // y puede estar procesándolo AHORA MISMO), o la fila ya venía en
    // "refund_requested" de un intento previo (crash entre el POST a MP y el
    // UPDATE final, o backlog legacy). No hay forma de distinguir estos casos
    // de forma local y segura, así que en NINGUNO de los dos se vuelve a
    // llamar a POST /refunds acá — eso es lo que garantiza que la carrera
    // nunca produzca un doble refund real. Solo se consulta MP (fuente de
    // verdad) para poder reconciliar si el refund YA se completó.
    const mpStatus = await getMercadoPagoPaymentStatus(mpId, clubAccessToken);
    if (mpStatus === "refunded") {
      const { error: syncErr } = await admin
        .from(DB_TABLES.payments)
        .update({ status: "refunded", updated_at: new Date().toISOString() })
        .eq("id", paymentId);
      if (syncErr) {
        return {
          kind: "refunded_unsynced",
          message:
            "Mercado Pago ya tiene este pago como reembolsado, pero no se pudo sincronizar el sistema local. No reintentes: contactá a soporte con el ID de pago.",
        };
      }
      return { kind: "refunded" };
    }
    // mpStatus === null (GET falló/incierto) o cualquier estado que no sea
    // "refunded": FAIL CLOSED. Nunca se ejecuta un POST /refunds a ciegas
    // sobre una fila cuyo dueño del intento no se puede determinar.
    return { kind: "failed" };
  }

  const result = await refundMercadoPagoPayment(mpId, clubAccessToken);
  if (!result.ok) return { kind: "failed" };

  // MP ya devolvió la plata acá: el `error` de este UPDATE ya NO se puede
  // ignorar, porque si falla el payment local queda "refund_requested" pese
  // a que el dinero real ya salió — y un reintento del caller podría volver
  // a pedirle a MP que reembolse un pago que MP ya considera reembolsado
  // (por eso el chequeo de mpStatus de arriba: el próximo intento lo detecta
  // y sincroniza sin volver a llamar a MP).
  const { error: updateErr } = await admin
    .from(DB_TABLES.payments)
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (updateErr) {
    return {
      kind: "refunded_unsynced",
      message:
        "El reembolso se procesó en Mercado Pago pero no se pudo registrar en el sistema. No reintentes: contactá a soporte con el ID de pago para reconciliar manualmente.",
    };
  }
  return { kind: "refunded" };
}

export type MatchRefundOutcome =
  | { kind: "refunded" }
  /** El match nunca tuvo un pago de MP aprobado (efectivo/transferencia/sin pagar) — cancelar sin prometer nada. */
  | { kind: "no_payment" }
  | { kind: "already_refunded" }
  | { kind: "failed"; message: string }
  /** Ver PaymentRefundOutcome["refunded_unsynced"]: MP ya reembolsó, la persistencia local falló. */
  | { kind: "refunded_unsynced"; message: string };

/**
 * Reembolso de una reserva (un solo pagador: `matches.owner_id`). Busca el
 * pago de MP del match y, si corresponde, ejecuta el reembolso real via
 * `refundApprovedPayment` y sincroniza los campos financieros del match.
 * Misma ruta de reembolso que usa el jugador — no duplica la llamada a MP.
 */
export async function refundReservationPayment(
  admin: SupabaseClient,
  matchId: string
): Promise<MatchRefundOutcome> {
  const { data: matchRow } = await admin
    .from(DB_TABLES.matches)
    .select("payment_status, financial_status, total_price")
    .eq("id", matchId)
    .maybeSingle();
  const m = matchRow as {
    payment_status: string | null;
    financial_status: string | null;
    total_price: number | null;
  } | null;
  if (!m) return { kind: "failed", message: "Reserva no encontrada." };

  const paymentStatus = String(m.payment_status ?? "").toLowerCase();
  const financialStatus = String(m.financial_status ?? "").toLowerCase();

  if (paymentStatus === "refunded") return { kind: "already_refunded" };

  // payment_status "paid" tambien lo usan los cobros offline confirmados (ver
  // app/admin/cobros/actions.ts), asi que esto solo habilita el intento — la
  // fila real de `payments` (mas abajo) es la que confirma si hubo MP de por medio.
  const mayHaveMpPayment =
    paymentStatus === "paid" ||
    paymentStatus === "refund_requested" ||
    financialStatus === "partially_paid" ||
    financialStatus === "fully_paid";
  if (!mayHaveMpPayment) return { kind: "no_payment" };

  // Reconciliación: un intento anterior puede haber logrado el refund en MP
  // Y persistido payments.status = "refunded", pero fallado en el UPDATE de
  // los campos financieros del match de más abajo (refunded_unsynced). Sin
  // este chequeo, el filtro .in(["approved","refund_requested"]) de abajo ya
  // no encuentra esa fila (quedó "refunded") y el caller recibiría
  // "no_payment" — un retry del admin quedaría atascado para siempre sin
  // poder sincronizar el match, pese a que el dinero ya está reembolsado.
  const { data: alreadyRefundedRow } = await admin
    .from(DB_TABLES.payments)
    .select("id")
    .eq("match_id", matchId)
    .eq("status", "refunded")
    .maybeSingle();
  if (alreadyRefundedRow) {
    const totalPrice = Number(m.total_price ?? 0);
    const { error: syncErr } = await admin
      .from(DB_TABLES.matches)
      .update({
        payment_status: "refunded",
        financial_status: "unpaid",
        amount_paid: 0,
        amount_pending: totalPrice,
      })
      .eq("id", matchId);
    if (syncErr) {
      return {
        kind: "refunded_unsynced",
        message:
          "El pago ya está reembolsado, pero no se pudo actualizar la reserva. No reintentes: contactá a soporte para reconciliar manualmente.",
      };
    }
    return { kind: "refunded" };
  }

  const { data: paymentRow } = await admin
    .from(DB_TABLES.payments)
    .select("id, payment_method, mp_payment_id")
    .eq("match_id", matchId)
    .in("status", ["approved", "refund_requested"])
    .maybeSingle();
  const p = paymentRow as { id: string; payment_method: string | null; mp_payment_id: string | null } | null;

  if (!p || (p.payment_method && p.payment_method !== "mercadopago") || !String(p.mp_payment_id ?? "").trim()) {
    // No hay un pago de MP real que reembolsar (fue efectivo/transferencia, o no hay fila).
    return { kind: "no_payment" };
  }

  const outcome = await refundApprovedPayment(admin, p.id);
  if (outcome.kind === "refunded_unsynced") {
    // Propagar tal cual: el caller NO debe reintentar (ver comentario del
    // tipo), solo mostrar el error y frenar.
    return { kind: "refunded_unsynced", message: outcome.message };
  }
  if (outcome.kind !== "refunded") {
    return {
      kind: "failed",
      message: "No se pudo procesar el reembolso en Mercado Pago. Intentá de nuevo o procesalo manualmente.",
    };
  }

  const totalPrice = Number(m.total_price ?? 0);
  // MP ya reembolsó y el payment local ya quedó en "refunded" (paso previo).
  // Si este UPDATE de matches falla, no se puede reportar "refunded" sin más:
  // el match quedaría con financial_status/amount_paid viejos pese a que
  // payments.status ya dice refunded — estado inconsistente y silencioso.
  const { error: matchUpdateErr } = await admin
    .from(DB_TABLES.matches)
    .update({
      payment_status: "refunded",
      financial_status: "unpaid",
      amount_paid: 0,
      amount_pending: totalPrice,
    })
    .eq("id", matchId);
  if (matchUpdateErr) {
    return {
      kind: "refunded_unsynced",
      message:
        "El reembolso se procesó en Mercado Pago pero no se pudo actualizar la reserva. No reintentes: contactá a soporte para reconciliar manualmente.",
    };
  }

  return { kind: "refunded" };
}
