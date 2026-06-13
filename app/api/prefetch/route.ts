import { NextResponse } from "next/server";
import { warmupHomeData } from "@/lib/home-cache";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// Capacitor Android sirve el shell desde https://localhost → el fetch es cross-origin.
// Sin estos headers, Android WebView rechaza la respuesta con CORS error aunque haya internet.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    await warmupHomeData(user.id);
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS_HEADERS });
  }
}
