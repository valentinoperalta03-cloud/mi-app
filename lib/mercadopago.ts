import { MercadoPagoConfig, Payment, PaymentRefund, Preference, PreApproval } from "mercadopago";

export function getMPClient() {
  return new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
  });
}

export function getPreferenceClient() {
  return new Preference(getMPClient());
}

export function getPaymentClient() {
  return new Payment(getMPClient());
}

export function getPaymentRefundClient() {
  return new PaymentRefund(getMPClient());
}

/**
 * Reembolso real contra la API de MP. Unica funcion que ejecuta un refund en
 * este proyecto — la usan tanto el jugador (app/(player)/reservas/actions.ts)
 * como las acciones de admin, para no duplicar la llamada a MP en cada lugar.
 * El pago se creo con el token del club (100% va a su cuenta), asi que el
 * reembolso tiene que hacerse con ese mismo token, no con el de plataforma.
 *
 * Idempotency key DETERMINISTICA (`refund:{mpPaymentId}`), no la aleatoria
 * que genera el SDK por default (RestClient.generateIdempotencyKey() arma un
 * UUID nuevo en CADA llamada si no se pasa una explicita — eso significa que,
 * sin este parametro, dos POST /v1/payments/{id}/refunds separados para el
 * MISMO pago viajan con keys distintas y MP no tiene forma de saber que son
 * el mismo intento). Con una key fija por pago, un reintento de esta funcion
 * para el mismo mpPaymentId (ej. tras un fallo de persistencia local que dejo
 * el estado incierto) reusa la key: si MP ya proceso el refund la primera
 * vez, el POST repetido no dispara una segunda devolucion de plata.
 *
 * Esto es defensa en profundidad, NO la unica proteccion: la fuente de
 * verdad real es getMercadoPagoPaymentStatus() (ver abajo), que lib/payment-refund.ts
 * consulta ANTES de llamar a esta funcion para no depender unicamente de que
 * MP honre la idempotency key igual que otros endpoints de su API — no hay
 * forma de verificar ese comportamiento puntual para /refunds sin pegarle a
 * produccion, asi que no se asume.
 */
export async function refundMercadoPagoPayment(
  mpPaymentId: string,
  clubAccessToken: string
): Promise<{ ok: true } | { ok: false }> {
  const id = String(mpPaymentId ?? "").trim();
  if (!id || id === "dev_simulated") return { ok: true };
  const token = String(clubAccessToken ?? "").trim();
  if (!token) {
    console.error("[mp] refund: falta clubAccessToken", { mpPaymentId: id });
    return { ok: false };
  }
  try {
    const refundClient = new PaymentRefund(new MercadoPagoConfig({ accessToken: token }));
    await refundClient.total({ payment_id: id, requestOptions: { idempotencyKey: `refund:${id}` } });
    return { ok: true };
  } catch (e) {
    console.error("[mp] refund", e);
    return { ok: false };
  }
}

/**
 * Consulta el estado REAL de un pago en MP (fuente de verdad, no la copia
 * local en `payments.status`). La usa refundApprovedPayment ANTES de pedir un
 * refund: si un intento anterior ya logro el refund en MP pero la
 * persistencia local fallo (`refunded_unsynced`), la fila local puede seguir
 * diciendo "approved" o "refund_requested" — sin esta consulta, una ejecucion
 * posterior (retry del admin, otro proceso) volveria a llamar a
 * refundMercadoPagoPayment a ciegas confiando en el estado local, que es
 * justo lo que quedo desincronizado.
 */
export async function getMercadoPagoPaymentStatus(
  mpPaymentId: string,
  clubAccessToken: string
): Promise<string | null> {
  const id = String(mpPaymentId ?? "").trim();
  if (!id || id === "dev_simulated") return null;
  const token = String(clubAccessToken ?? "").trim();
  if (!token) return null;
  try {
    const paymentClient = new Payment(new MercadoPagoConfig({ accessToken: token }));
    const payment = await paymentClient.get({ id });
    return String((payment as { status?: string | null } | null)?.status ?? "")
      .trim()
      .toLowerCase() || null;
  } catch (e) {
    console.error("[mp] get payment status", e);
    return null;
  }
}

/** Suscripciones (debito automatico) del plan mensual PadeLibre a clubes. */
export function getPreApprovalClient() {
  return new PreApproval(getMPClient());
}
