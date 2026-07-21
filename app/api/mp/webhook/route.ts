import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/lib/mp-handlers/payment-webhook-handler";

export async function POST(req: Request) {
  return handlePaymentWebhook(req);
}

/** Mercado Pago puede enviar GET en algunas configuraciones antiguas. */
export async function GET(req: Request) {
  return handlePaymentWebhook(req);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
