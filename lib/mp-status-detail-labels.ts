/**
 * Traduce el status_detail tecnico de Mercado Pago a un mensaje amigable
 * para mostrar al dueño del club. Nunca se debe exponer el codigo tecnico
 * crudo en la UI ni en emails.
 */
const STATUS_DETAIL_LABELS: Record<string, string> = {
  there_is_not_enough_money_in_payer_s_account_to_complete_this_operation:
    "No había saldo suficiente disponible en tu cuenta de Mercado Pago.",
  cc_rejected_insufficient_amount: "No había saldo suficiente disponible en tu medio de pago.",
  cc_rejected_bad_filled_card_number: "El número de la tarjeta es inválido. Revisá los datos cargados.",
  cc_rejected_bad_filled_date: "La fecha de vencimiento de la tarjeta es inválida.",
  cc_rejected_bad_filled_security_code: "El código de seguridad de la tarjeta es inválido.",
  cc_rejected_bad_filled_other: "Revisá los datos de tu tarjeta, hay un error en la carga.",
  cc_rejected_call_for_authorize: "Tu banco no autorizó el pago. Contactá a tu banco o probá con otro medio.",
  cc_rejected_card_disabled: "Tu tarjeta está deshabilitada. Contactá a tu banco o probá con otro medio.",
  cc_rejected_card_error: "No pudimos procesar el pago con esa tarjeta.",
  cc_rejected_duplicated_payment: "Ya se realizó un pago con el mismo importe hace poco.",
  cc_rejected_high_risk: "El pago fue rechazado por un control de seguridad de Mercado Pago.",
  cc_rejected_max_attempts: "Se alcanzó el máximo de intentos permitidos con esa tarjeta.",
  cc_rejected_other_reason: "Tu banco o Mercado Pago rechazó el pago sin especificar el motivo.",
  cc_rejected_invalid_installments: "La cantidad de cuotas seleccionada no es válida para esa tarjeta.",
  cc_rejected_card_type_not_allowed: "Ese tipo de tarjeta no está habilitado para este cobro.",
  expired_card: "La tarjeta cargada está vencida.",
};

const DEFAULT_LABEL = "Mercado Pago rechazó el pago. Revisá tu saldo o medio de pago.";

export function translateMpStatusDetail(statusDetail: string | null | undefined): string {
  const key = String(statusDetail ?? "").trim().toLowerCase();
  if (!key) return DEFAULT_LABEL;
  return STATUS_DETAIL_LABELS[key] ?? DEFAULT_LABEL;
}
