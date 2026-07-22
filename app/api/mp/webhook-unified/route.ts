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
  let topic = url.searchParams.get("topic") ?? url.searchParams.get("type");

  // MP v2 (webhooks nuevos) manda el topic solo en el body ("type"), sin
  // query params. Clonamos el request para espiar el body sin consumirlo:
  // los handlers de abajo vuelven a leer `req.json()` sobre el original.
  if (!topic && req.headers.get("content-type")?.includes("application/json")) {
    const bodyPeek = await req
      .clone()
      .json()
      .catch(() => null);
    if (bodyPeek && typeof bodyPeek === "object") {
      const b = bodyPeek as { type?: string; topic?: string };
      topic = b.type ?? b.topic ?? null;
    }
  }

  // Comparacion exacta primero, pero MP puede mandar variantes con prefijo
  // (ej. "subscription_preapproval", "subscription_authorized_payment") que
  // antes caian en unknown_topic y nunca llegaban al handler correcto.
  const normalizedTopic = (topic ?? "").toLowerCase();
  const isSubscriptionTopic =
    normalizedTopic === "preapproval" ||
    normalizedTopic === "authorized_payment" ||
    normalizedTopic.includes("preapproval") ||
    normalizedTopic.includes("authorized_payment") ||
    normalizedTopic.includes("subscription");
  const isPaymentTopic =
    normalizedTopic === "payment" ||
    normalizedTopic === "merchant_order" ||
    normalizedTopic.includes("merchant_order") ||
    normalizedTopic.includes("payment");

  // Si un topic matchea ambas (ej. "subscription_payment"), prioridad a suscripcion.
  if (isSubscriptionTopic) {
    return handleSubscriptionWebhook(req);
  }
  if (isPaymentTopic) {
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
