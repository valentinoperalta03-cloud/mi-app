import { DB_TABLES } from "@/lib/db-tables";
import { parseClockToMinutes, parseCloseTimeToMinutes } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";
import type { TimelineEvent, TimelineOpenRange } from "./timeline-grid";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type DashboardCourtCtx = { id: string; name: string | null };
export type DashboardClubBounds = { open_time: string | null; close_time: string | null };

export type DashboardTimelineData = {
  openRangesByCourtId: Record<string, TimelineOpenRange[]>;
  events: TimelineEvent[];
};

export type DashboardTimelineMatchRow = {
  id: string;
  court_id: string;
  owner_id: string | null;
  scheduled_time: string | null;
  match_status: string | null;
  match_type: string | null;
  es_turno_fijo: boolean | null;
  duration_minutes: number | null;
};

export function timeToMinutes(value: string | null): number {
  const t = String(value ?? "").slice(0, 5);
  const [hRaw, mRaw] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

/**
 * Franjas abiertas por cancha + eventos (reservas, partidos abiertos, turnos
 * fijos, entrenamientos) para un día puntual. Usado tanto por la carga
 * inicial del dashboard (hoy) como por getDashboardData al navegar días, para
 * que ambos caminos produzcan exactamente el mismo resultado.
 */
/**
 * `todayMatches`, si se pasa, reemplaza la query interna de matches del día
 * (el caller ya la trajo, p.ej. el dashboard del día de hoy) — evita traer la
 * misma tabla dos veces en el mismo request. Solo válido cuando `dateStr`
 * coincide con la fecha de esas filas; el caller es responsable de eso.
 */
export async function buildDashboardTimelineData(
  supabase: SupabaseClient,
  courts: DashboardCourtCtx[],
  courtIds: string[],
  clubIds: string[],
  clubBounds: DashboardClubBounds | null,
  dateStr: string,
  todayMatches?: DashboardTimelineMatchRow[]
): Promise<DashboardTimelineData> {
  const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();

  let matches: DashboardTimelineMatchRow[];
  if (todayMatches) {
    matches = todayMatches;
  } else {
    const { data: matchesRaw } = courtIds.length
      ? await supabase
          .from(DB_TABLES.matches)
          .select("id,court_id,owner_id,scheduled_time,match_status,match_type,es_turno_fijo,duration_minutes")
          .in("court_id", courtIds)
          .eq("scheduled_date", dateStr)
      : { data: [] };
    matches = (matchesRaw ?? []) as DashboardTimelineMatchRow[];
  }

  const { data: fixedSlotsRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlots)
        .select("id,court_id,title,start_time,duration_minutes")
        .in("court_id", courtIds)
        .eq("is_active", true)
        .eq("day_of_week", dayOfWeek)
    : { data: [] };
  const fixedSlots = (fixedSlotsRaw ?? []) as Array<{
    id: string;
    court_id: string;
    title: string | null;
    start_time: string | null;
    duration_minutes: number | null;
  }>;
  const fixedSlotIds = fixedSlots.map((s) => s.id);

  const { data: exceptionsRaw } = fixedSlotIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlotExceptions)
        .select("fixed_slot_id")
        .in("fixed_slot_id", fixedSlotIds)
        .eq("exception_date", dateStr)
    : { data: [] };
  const exceptedIds = new Set(((exceptionsRaw ?? []) as Array<{ fixed_slot_id: string }>).map((e) => e.fixed_slot_id));

  const { data: trainingBlocksRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtBlocks)
        .select("id,court_id,blocked_time")
        .in("court_id", courtIds)
        .eq("blocked_date", dateStr)
        .eq("reason", "entrenamiento_externo")
    : { data: [] };
  const trainingBlocks = (trainingBlocksRaw ?? []) as Array<{ id: string; court_id: string; blocked_time: string }>;

  const { data: trainingMetaRaw } = clubIds.length
    ? await supabase
        .from(DB_TABLES.trainingBlocks)
        .select("court_id,title,coach,start_time,end_time")
        .in("club_id", clubIds)
        .eq("is_active", true)
        .eq("day_of_week", dayOfWeek)
    : { data: [] };
  const trainingMeta = (trainingMetaRaw ?? []) as Array<{
    court_id: string;
    title: string;
    coach: string | null;
    start_time: string;
    end_time: string;
  }>;
  const trainingMetaByKey = new Map(
    trainingMeta.map((t) => [
      `${t.court_id}__${String(t.start_time).slice(0, 5)}`,
      { title: t.title, coach: t.coach, endTime: String(t.end_time).slice(0, 5) },
    ])
  );

  const { data: timeRangesRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtTimeRanges)
        .select("court_id,open_time,close_time")
        .in("court_id", courtIds)
        .eq("day_of_week", dayOfWeek)
    : { data: [] };
  const timeRanges = (timeRangesRaw ?? []) as Array<{ court_id: string; open_time: string; close_time: string }>;

  const clubOpenMin = clubBounds?.open_time ? parseClockToMinutes(String(clubBounds.open_time).slice(0, 5)) : null;
  const clubCloseMin = clubBounds?.close_time ? parseCloseTimeToMinutes(String(clubBounds.close_time).slice(0, 5)) : null;

  const timeRangesByCourt = new Map<string, TimelineOpenRange[]>();
  for (const r of timeRanges) {
    const list = timeRangesByCourt.get(r.court_id) ?? [];
    list.push({
      startMin: parseClockToMinutes(String(r.open_time).slice(0, 5)),
      endMin: parseCloseTimeToMinutes(String(r.close_time).slice(0, 5)),
    });
    timeRangesByCourt.set(r.court_id, list);
  }

  const openRangesByCourtId: Record<string, TimelineOpenRange[]> = {};
  for (const court of courts) {
    const custom = timeRangesByCourt.get(court.id);
    if (custom && custom.length > 0) {
      openRangesByCourtId[court.id] = custom;
    } else if (clubOpenMin != null && clubCloseMin != null && clubCloseMin > clubOpenMin) {
      openRangesByCourtId[court.id] = [{ startMin: clubOpenMin, endMin: clubCloseMin }];
    } else {
      openRangesByCourtId[court.id] = [{ startMin: 9 * 60, endMin: 22 * 60 + 30 }];
    }
  }

  const reservaOwnerIds = Array.from(
    new Set(
      matches
        .filter(
          (m) =>
            !m.es_turno_fijo &&
            m.match_type !== "amistoso" &&
            String(m.match_status ?? "").toLowerCase() !== "cancelled"
        )
        .map((m) => m.owner_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const { data: ownerProfilesRaw } = reservaOwnerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", reservaOwnerIds)
    : { data: [] };
  const ownerNameById = new Map(
    ((ownerProfilesRaw ?? []) as Array<{ user_id: string; name: string | null }>).map((p) => [
      p.user_id,
      p.name?.trim() || "Jugador",
    ])
  );

  const openMatchIds = matches
    .filter((m) => m.match_type === "amistoso" && String(m.match_status ?? "").toLowerCase() !== "cancelled")
    .map((m) => m.id);
  const { data: participantsRaw } = openMatchIds.length
    ? await supabase.from(DB_TABLES.matchParticipants).select("match_id").in("match_id", openMatchIds)
    : { data: [] };
  const participantCountByMatch = new Map<string, number>();
  for (const p of (participantsRaw ?? []) as Array<{ match_id: string }>) {
    participantCountByMatch.set(p.match_id, (participantCountByMatch.get(p.match_id) ?? 0) + 1);
  }

  const events: TimelineEvent[] = [];

  for (const m of matches) {
    if (m.es_turno_fijo) continue;
    if (String(m.match_status ?? "").toLowerCase() === "cancelled") continue;
    const startMin = timeToMinutes(m.scheduled_time);
    if (startMin < 0) continue;
    const isOpenMatch = m.match_type === "amistoso";
    events.push({
      id: `match-${m.id}`,
      courtId: m.court_id,
      startMin,
      durationMin: m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : 90,
      kind: isOpenMatch ? "partido_abierto" : "reserva",
      label: isOpenMatch
        ? `Partido abierto (${participantCountByMatch.get(m.id) ?? 0}/4)`
        : m.owner_id
          ? ownerNameById.get(m.owner_id) ?? "Jugador"
          : "Jugador",
    });
  }

  for (const slot of fixedSlots) {
    if (exceptedIds.has(slot.id)) continue;
    const startMin = timeToMinutes(slot.start_time);
    if (startMin < 0) continue;
    events.push({
      id: `fixed-${slot.id}`,
      courtId: slot.court_id,
      startMin,
      durationMin: slot.duration_minutes && slot.duration_minutes > 0 ? slot.duration_minutes : 90,
      kind: "turno_fijo",
      label: slot.title?.trim() || "Turno fijo",
    });
  }

  for (const b of trainingBlocks) {
    const startMin = timeToMinutes(b.blocked_time);
    if (startMin < 0) continue;
    const meta = trainingMetaByKey.get(`${b.court_id}__${String(b.blocked_time).slice(0, 5)}`);
    const durationMin = meta ? Math.max(30, timeToMinutes(meta.endTime) - startMin) : 90;
    events.push({
      id: `training-${b.id}`,
      courtId: b.court_id,
      startMin,
      durationMin,
      kind: "entrenamiento",
      label: meta ? (meta.coach ? `${meta.title} · ${meta.coach}` : meta.title) : "Entrenamiento externo",
    });
  }

  return { openRangesByCourtId, events };
}
