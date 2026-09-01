import { type NextRequest, NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { generateMatchForSlotOnDate, getUpcomingDatesForDayOfWeek } from "@/lib/fixed-slot-generator";
import { createServiceClient } from "@/utils/supabase/server";

// Reconcilia una ventana de 14 días en lugar de una sola fecha (hoy + 7): si el
// cron no corre un día (deploy, downtime) la fecha que dependía de esa corrida
// se perdía para siempre, porque al día siguiente el cron ya apuntaba a otra
// fecha objetivo. Reconciliar un rango hace que cualquier corrida futura repare
// los huecos. Es idempotente: generateMatchForSlotOnDate ya chequea excepciones
// y matches existentes antes de crear.
const RECONCILE_DAYS_AHEAD = 14;

function getArgentinaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T12:00:00`);
}

function cronSecretFromRequest(req: NextRequest): string | null {
  const bearer = req.headers.get("authorization");
  const bearerSecret =
    bearer?.startsWith("Bearer ") ? bearer.slice("Bearer ".length).trim() : null;
  return (
    req.headers.get("x-cron-secret")?.trim() ??
    req.nextUrl.searchParams.get("secret") ??
    bearerSecret
  );
}

export async function GET(req: NextRequest) {
  const secret = cronSecretFromRequest(req);
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = getArgentinaNow();

  const { data: slotsRaw } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,club_id,court_id,day_of_week,start_time,duration_minutes,is_active")
    .eq("is_active", true);

  const slots = (slotsRaw ?? []) as Array<{
    id: string;
    club_id: string;
    court_id: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    is_active: boolean;
  }>;

  let created = 0;
  let checked = 0;
  const conflicts: Array<{ fixedSlotId: string; date: string; reason: string }> = [];

  for (const slot of slots) {
    const dates = getUpcomingDatesForDayOfWeek(slot.day_of_week, now, RECONCILE_DAYS_AHEAD);
    for (const date of dates) {
      checked++;
      const result = await generateMatchForSlotOnDate(supabase, slot, date);
      if (result.created) {
        created++;
      } else if (
        result.reason !== "hay una excepción cargada para esa fecha" &&
        result.reason !== "ya existe un match de turno fijo para esa fecha/hora"
      ) {
        conflicts.push({ fixedSlotId: slot.id, date, reason: result.reason });
      }
    }
  }

  return NextResponse.json({ ok: true, checked, created, conflicts });
}
