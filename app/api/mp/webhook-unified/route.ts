import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { handlePaymentWebhook } from "@/lib/mp-handlers/payment-webhook-handler";
import { handleSubscriptionWebhook } from "@/lib/mp-handlers/subscription-webhook-handler";

/**
 * Endpoint unico para configurar en el panel de Mercado Pago: enruta segun
 * `topic`/`type` a la misma logica que ya usan /api/mp/webhook (payment,
 * merchant_order) y /api/mp/subscriptions/webhook (preapproval,
 * authorized_payment). Ambos endpoints originales siguen funcionando
 * de forma independiente — llaman a las mismas funciones de lib/mp-handlers.
 */
async function handleUnifiedNotification(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? url.searchParams.get("type");

  if (topic === "preapproval" || topic === "authorized_payment") {
    return handleSubscriptionWebhook(req);
  }
  if (topic === "payment" || topic === "merchant_order") {
    return handlePaymentWebhook(req);
  }

  console.warn(`[webhook-unified] topic desconocido: ${topic}`);
  log.warn({ event: "mp.webhook_unified.unknown_topic", topic });
  return NextResponse.json({ received: true, skipped: "unknown_topic" });
}

export async function POST(req: Request) {
  return handleUnifiedNotification(req);
}

/** Mercado Pago puede enviar GET en algunas configuraciones antiguas. */
export async function GET(req: Request) {
  return handleUnifiedNotification(req);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
