import { addDays, format } from "date-fns";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminGuideBox from "@/components/admin/admin-guide-box";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminCard, adminTip } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { buildSlotsForDay, type CourtTimeRangeInput } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";
import TurnosFijosGrid, { type GridCell } from "./turnos-grid-client";

const FIXED_SLOT_DURATION_MINUTES = 90;

/** 2023-01-01 fue domingo — ancla para pedirle a buildSlotsForDay el día de semana que necesitamos. */
function referenceDateForDow(dayOfWeek: number): Date {
  return new Date(2023, 0, 1 + dayOfWeek);
}

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

  const { data: clubHoursRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("open_time,close_time")
    .eq("id", ctx.clubIds[0])
    .maybeSingle();
  const clubOpenTime = String((clubHoursRow as { open_time?: string | null } | null)?.open_time ?? "").trim().slice(0, 5);
  const clubCloseTime = String((clubHoursRow as { close_time?: string | null } | null)?.close_time ?? "").trim().slice(0, 5);
  const clubBounds = { open_time: clubOpenTime || null, close_time: clubCloseTime || null };

  const { data: courtTimeRangesRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.courtTimeRanges)
        .select("court_id,day_of_week,open_time,close_time")
        .in("court_id", ctx.courtIds)
    : { data: [] };
  const courtTimeRanges = (courtTimeRangesRaw ?? []) as CourtTimeRangeInput[];

  // Mismo criterio que buildTurnsForDay (court-prices-client.tsx): franjas
  // propias de court_time_ranges por cancha/día, con fallback al horario del
  // club — así turnos fijos y precios/horarios de canchas usan la misma
  // disponibilidad real en vez de un horario fijo de 90min hasta medianoche.
  const availableSlotsByCourtAndDay: Record<string, Record<number, string[]>> = {};
  for (const courtId of ctx.courtIds) {
    availableSlotsByCourtAndDay[courtId] = {};
    for (let day = 0; day <= 6; day++) {
      const slots = buildSlotsForDay(
        [courtId],
        referenceDateForDow(day),
        courtTimeRanges,
        clubBounds,
        FIXED_SLOT_DURATION_MINUTES
      );
      availableSlotsByCourtAndDay[courtId][day] = slots.map((s) => s.time);
    }
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
      <AdminPageHeader
        kicker="Gestión de juego"
        title="Turnos fijos"
        subtitle="Configurá los turnos semanales de tus canchas"
      />

      <AdminGuideBox title="¿Cómo funcionan los turnos fijos?">
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
      </AdminGuideBox>

      <section className={adminCard}>
        <TurnosFijosGrid
          courts={gridCourts}
          availableSlotsByCourtAndDay={availableSlotsByCourtAndDay}
          cells={cells}
          initialDay={initialDay}
        />
      </section>
    </div>
  );
}
