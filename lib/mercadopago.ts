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

/** Suscripciones (debito automatico) del plan mensual PadeLibre a clubes. */
export function getPreApprovalClient() {
  return new PreApproval(getMPClient());
}
