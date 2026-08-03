import { addDays, format } from "date-fns";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTip, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { minutesToClock, parseClockToMinutes } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";
import TurnosFijosGrid, { type GridCell } from "./turnos-grid-client";

/** Próxima fecha (yyyy-MM-dd) en la que cae ese día de semana, a partir de hoy. */
function nextDateForDay(dayOfWeek: number, todayYmd: string): string {
  const base = new Date(`${todayYmd}T12:00:00`);
  const delta = (dayOfWeek - base.getDay() + 7) % 7;
  return format(addDays(base, delta), "yyyy-MM-dd");
}

export default async function AdminTurnosFijosPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  if (ctx.clubIds.length === 0) {
    return (
      <div className={`${adminCard} border-amber-200/80 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40`}>
        <AdminBackLink />
        <p className="mt-4 text-sm font-semibold text-[var(--text-secondary)]">Sin club asignado.</p>
      </div>
    );
  }

  const todayYmd = getTodayYmdInArgentina();
  const initialDay = new Date(`${todayYmd}T12:00:00`).getDay();

  const { data: clubOpenRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("open_time")
    .eq("id", ctx.clubIds[0])
    .maybeSingle();
  const clubOpenTime =
    String((clubOpenRow as { open_time?: string | null } | null)?.open_time ?? "09:00")
      .trim()
      .slice(0, 5) || "09:00";
  const rawOpenMin = parseClockToMinutes(clubOpenTime);
  const times: string[] = [];
  for (let t = rawOpenMin; t < 24 * 60; t += 90) {
    times.push(minutesToClock(t));
  }

  const { data: slotsRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlots)
        .select("id,court_id,day_of_week,start_time,title")
        .in("court_id", ctx.courtIds)
        .eq("is_active", true)
    : { data: [] };
  const slots = (slotsRaw ?? []) as Array<{
    id: string;
    court_id: string;
    day_of_week: number;
    start_time: string;
    title: string | null;
  }>;

  const slotIds = slots.map((s) => s.id);
  const { data: slotPlayersRaw } = slotIds.length
    ? await supabase.from(DB_TABLES.fixedSlotPlayers).select("fixed_slot_id,player_id").in("fixed_slot_id", slotIds)
    : { data: [] };
  const slotPlayers = (slotPlayersRaw ?? []) as Array<{ fixed_slot_id: string; player_id: string }>;

  const playerIds = Array.from(new Set(slotPlayers.map((p) => p.player_id)));
  const { data: profilesData } = playerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", playerIds)
    : { data: [] };
  const nameById = new Map(
    (profilesData ?? []).map((p: { user_id: string; name: string | null }) => [
      p.user_id,
      p.name?.trim() || "Jugador",
    ])
  );

  const playersBySlot = new Map<string, Array<{ playerId: string; name: string }>>();
  for (const p of slotPlayers) {
    const list = playersBySlot.get(p.fixed_slot_id) ?? [];
    list.push({ playerId: p.player_id, name: nameById.get(p.player_id) ?? "Jugador" });
    playersBySlot.set(p.fixed_slot_id, list);
  }

  const nextDateBySlot = new Map<string, string>();
  for (const slot of slots) {
    nextDateBySlot.set(slot.id, nextDateForDay(slot.day_of_week, todayYmd));
  }
  const nextDates = Array.from(new Set(nextDateBySlot.values()));

  const { data: exceptionsRaw } =
    slotIds.length && nextDates.length
      ? await supabase
          .from(DB_TABLES.fixedSlotExceptions)
          .select("fixed_slot_id,exception_date")
          .in("fixed_slot_id", slotIds)
          .in("exception_date", nextDates)
      : { data: [] };
  const exceptionKeys = new Set(
    ((exceptionsRaw ?? []) as Array<{ fixed_slot_id: string; exception_date: string }>).map(
      (e) => `${e.fixed_slot_id}__${e.exception_date}`
    )
  );

  const cells: Record<string, GridCell> = {};
  for (const slot of slots) {
    const nextDateYmd = nextDateBySlot.get(slot.id) ?? todayYmd;
    const key = `${slot.day_of_week}__${slot.court_id}__${String(slot.start_time).slice(0, 5)}`;
    cells[key] = {
      fixedSlotId: slot.id,
      title: slot.title?.trim() || "Turno fijo",
      players: playersBySlot.get(slot.id) ?? [],
      nextDateYmd,
      nextDateLabel: format(new Date(`${nextDateYmd}T12:00:00`), "dd/MM"),
      hasExceptionForNext: exceptionKeys.has(`${slot.id}__${nextDateYmd}`),
    };
  }

  const gridCourts = ctx.courts.map((c) => ({ id: c.id, name: c.name ?? "Cancha" }));

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0085FC]`}>Operación semanal</p>
        <h1 className={adminTitle}>Turnos fijos</h1>
        <p className={adminSubtitle}>Tocá una celda libre para crear un turno fijo recurrente.</p>
      </header>

      <details className="group overflow-hidden rounded-3xl border border-sky-200 bg-sky-100 dark:border-sky-800/60 dark:bg-sky-900/25">
        <summary className="flex cursor-pointer select-none items-center gap-2.5 px-5 py-4 text-sm font-semibold text-sky-900 marker:content-none dark:text-sky-100">
          <Info size={18} className="shrink-0 text-sky-600 dark:text-sky-400" />
          ¿Cómo funcionan los turnos fijos?
          <span className="ml-auto text-xs font-normal text-sky-600 dark:text-sky-400 group-open:hidden">Ver guía</span>
          <span className="ml-auto hidden text-xs font-normal text-sky-600 dark:text-sky-400 group-open:inline">Cerrar</span>
        </summary>
        <div className="space-y-4 border-t border-sky-200/60 px-5 pb-5 pt-4 text-sm text-[var(--text-secondary)] dark:border-sky-800/40">
          <div>
            <p className="font-bold text-[var(--text-primary)]">¿Qué es un turno fijo?</p>
            <p className="mt-1 leading-relaxed">
              Un horario recurrente que se repite todas las semanas en el mismo día y hora. Tocá una celda libre en
              la grilla, ponele un título (ej. el apellido del grupo) y, si querés, asignale hasta 4 jugadores.
            </p>
          </div>
          <div>
            <p className="font-bold text-[var(--text-primary)]">No viene esta semana</p>
            <p className="mt-1 leading-relaxed">
              Libera la cancha solo para la próxima fecha de ese turno, sin afectar las semanas siguientes.
            </p>
          </div>
          <div>
            <p className="font-bold text-[var(--text-primary)]">Dar de baja</p>
            <p className="mt-1 leading-relaxed">
              Termina el turno fijo para siempre y cancela todos los partidos futuros ya generados.
            </p>
          </div>
          <div className={adminTip}>
            <span className="font-bold">Consejo:</span> los turnos con jugadores asignados les avisan a los
            jugadores y les recuerdan confirmar asistencia. Los turnos sin jugadores solo reservan la cancha.
          </div>
        </div>
      </details>

      <section className={adminCard}>
        <TurnosFijosGrid courts={gridCourts} times={times} cells={cells} initialDay={initialDay} />
      </section>
    </div>
  );
}
