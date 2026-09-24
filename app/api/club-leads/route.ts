import { NextResponse } from "next/server";
import { CLUB_LEAD_SOURCE, validateClubLead } from "@/lib/club-leads";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/utils/supabase/server";

// Un humano no completa 3 campos en menos de esto; los bots que postean directo sí.
const MIN_FILL_MS = 1500;
const DUPLICATE_WINDOW_MS = 24 * 3600 * 1000;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  // Honeypot: campo oculto que solo completan los bots. Se descarta sin guardar.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const elapsed = Number(body.elapsedMs);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return NextResponse.json(
      { error: "Revisá tus datos un segundo y volvé a enviar." },
      { status: 400 }
    );
  }

  const parsed = validateClubLead({
    clubName: body.clubName,
    dial: body.dial,
    phone: body.phone,
    problem: body.problem,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: "Revisá los datos marcados.", fieldErrors: parsed.errors }, { status: 400 });
  }
  const lead = parsed.value;

  if (!(await checkRateLimit(`club-lead:ip:${clientIp(req)}`, 5, 3600))) {
    return NextResponse.json({ error: "Recibimos muchas consultas desde tu conexión. Probá de nuevo en un rato." }, { status: 429 });
  }

  const svc = createServiceClient();

  // Mismo número en las últimas 24 h: ya está en la bandeja del equipo, no duplicar.
  const { data: recent, error: recentError } = await svc
    .from(DB_TABLES.clubLeads)
    .select("id")
    .eq("whatsapp", lead.whatsapp)
    .gte("created_at", new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString())
    .limit(1);
  if (recentError) {
    log.error({ event: "club_leads.dedupe_failed", err: recentError });
    return NextResponse.json({ error: "No pudimos guardar tu consulta. Intentá de nuevo." }, { status: 500 });
  }
  if (recent && recent.length > 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (!(await checkRateLimit(`club-lead:wa:${lead.whatsapp}`, 3, 86400))) {
    return NextResponse.json({ error: "Ya recibimos consultas de este número. El equipo se va a comunicar con vos." }, { status: 429 });
  }

  const { error } = await svc.from(DB_TABLES.clubLeads).insert({
    club_name: lead.clubName,
    whatsapp: lead.whatsapp,
    problem: lead.problem,
    source: CLUB_LEAD_SOURCE,
  });
  if (error) {
    log.error({ event: "club_leads.insert_failed", err: error });
    return NextResponse.json({ error: "No pudimos guardar tu consulta. Intentá de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
