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
    await refundClient.total({ payment_id: id });
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
