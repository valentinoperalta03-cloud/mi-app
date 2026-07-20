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
 */
export async function refundMercadoPagoPayment(mpPaymentId: string): Promise<{ ok: true } | { ok: false }> {
  const id = String(mpPaymentId ?? "").trim();
  if (!id || id === "dev_simulated") return { ok: true };
  try {
    await getPaymentRefundClient().total({ payment_id: id });
    return { ok: true };
  } catch (e) {
    console.error("[mp] refund", e);
    return { ok: false };
  }
}

/** Suscripciones (debito automatico) del plan mensual PadeLibre a clubes. */
export function getPreApprovalClient() {
  return new PreApproval(getMPClient());
}
