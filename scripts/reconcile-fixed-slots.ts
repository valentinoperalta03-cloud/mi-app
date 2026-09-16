/**
 * Repara turnos fijos activos que tienen ocurrencias futuras faltantes en
 * `matches`. Reutiliza generateMatchForSlotOnDate (misma lógica que el cron y
 * createFixedSlot), así que respeta turno activo, excepciones, días cerrados,
 * matches ya existentes, ocupación de la cancha y bloqueos. Es idempotente:
 * correrlo varias veces no duplica nada.
 *
 * Uso: node --env-file=.env.local -r tsx/cjs scripts/reconcile-fixed-slots.ts [--days=14] [--dry-run]
 *   (o: npx tsx scripts/reconcile-fixed-slots.ts, con las env vars ya exportadas en el shell)
 */
import { createServiceRoleClient } from "../lib/supabase-service";
import {
  BENIGN_SKIP_REASONS,
  generateMatchForSlotOnDate,
  getUpcomingDatesForDayOfWeek,
} from "../lib/fixed-slot-generator";
import { DB_TABLES } from "../lib/db-tables";

function getArgentinaNow(): Date {
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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const daysArg = args.find((a) => a.startsWith("--days="));
  const daysAhead = daysArg ? Number(daysArg.split("=")[1]) : 14;

  const supabase = createServiceRoleClient();
  const now = getArgentinaNow();

  const { data: slotsRaw, error: slotsErr } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,club_id,court_id,day_of_week,start_time,duration_minutes,title,is_active")
    .eq("is_active", true);

  if (slotsErr) {
    console.error("No se pudieron leer fixed_slots:", slotsErr.message);
    process.exit(1);
  }

  const slots = (slotsRaw ?? []) as Array<{
    id: string;
    club_id: string;
    court_id: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    title: string | null;
    is_active: boolean;
  }>;

  console.log(
    `[reconcile-fixed-slots] ${slots.length} turnos fijos activos. Ventana: ${daysAhead} días. dry-run=${dryRun}`
  );

  let created = 0;
  let checked = 0;
  const createdRows: Array<{ slotId: string; title: string | null; date: string; matchId: string }> = [];
  const skippedConflicts: Array<{ slotId: string; title: string | null; date: string; reason: string }> = [];

  for (const slot of slots) {
    const dates = getUpcomingDatesForDayOfWeek(slot.day_of_week, now, daysAhead);
    for (const date of dates) {
      checked++;

      // Misma función central que el cron, también en dry-run: la RPC corre
      // todos los chequeos (activo, excepción, día cerrado, ocupación, dedupe)
      // y en dry-run no escribe nada.
      const result = await generateMatchForSlotOnDate(supabase, slot, date, { dryRun });
      if (result.created) {
        created++;
        createdRows.push({ slotId: slot.id, title: slot.title, date, matchId: result.matchId });
        console.log(`[reparado] slot=${slot.id} (${slot.title ?? ""}) fecha=${date} -> match=${result.matchId}`);
      } else if (result.wouldCreate) {
        console.log(`[dry-run] faltaría crear: slot=${slot.id} (${slot.title ?? ""}) fecha=${date}`);
      } else if (!BENIGN_SKIP_REASONS.has(result.reason)) {
        skippedConflicts.push({ slotId: slot.id, title: slot.title, date, reason: result.reason });
        console.warn(`[conflicto] slot=${slot.id} (${slot.title ?? ""}) fecha=${date}: ${result.reason}`);
      }
    }
  }

  console.log("\n--- Resumen ---");
  console.log(`Ocurrencias chequeadas: ${checked}`);
  console.log(`Matches creados: ${created}`);
  console.log(`Conflictos/errores no resueltos: ${skippedConflicts.length}`);
  if (skippedConflicts.length > 0) {
    console.log(JSON.stringify(skippedConflicts, null, 2));
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
