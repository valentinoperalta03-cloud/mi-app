import { NextResponse } from "next/server";
import { autoConfirmExpiredResults } from "@/app/(player)/partidos/[id]/match-result-actions";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await autoConfirmExpiredResults();
  return NextResponse.json({ ok: true });
}
