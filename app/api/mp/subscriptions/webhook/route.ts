import { NextResponse } from "next/server";
import { handleSubscriptionWebhook } from "@/lib/mp-handlers/subscription-webhook-handler";

export async function POST(req: Request) {
  return handleSubscriptionWebhook(req);
}

/** MP puede enviar GET en algunas configuraciones antiguas (igual que el webhook de pagos). */
export async function GET(req: Request) {
  return handleSubscriptionWebhook(req);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
