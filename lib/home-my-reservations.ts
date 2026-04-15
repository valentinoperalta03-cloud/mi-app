import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { DB_TABLES } from "@/lib/db-tables";

export type HomeReservationCard = {
  matchId: string;
  clubName: string;
  dateLine: string;
  timeLine: string;
  matchTypeLabel: string;
  slotsFilled: number;
  slotsFree: number;
};

const SLOTS_TOTAL = 4;

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function unwrapMatch(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return (raw[0] as Record<string, unknown>) ?? null;
  return raw as Record<string, unknown>;
}

function clubNameFromMatch(m: Record<string, unknown>): string {
  const courts = m.courts as unknown;
  const court = Array.isArray(courts) ? courts[0] : courts;
  const c = court as { clubs?: unknown } | null | undefined;
  if (!c?.clubs) return "Club";
  const cl = c.clubs;
  const club = Array.isArray(cl) ? cl[0] : cl;
  const name = (club as { name?: string | null } | null)?.name?.trim();
  return name || "Club";
}

function participantCount(m: Record<string, unknown>): number {
  const mp = m.match_participants as { player_id?: string }[] | null | undefined;
  return mp?.length ?? 0;
}

function effectiveSchedule(m: Record<string, unknown>): {
  ymd: string;
  timeKey: string;
  dateLine: string;
  timeLine: string;
} {
  const scheduledDate = typeof m.scheduled_date === "string" ? m.scheduled_date.trim() : "";
  const scheduledTime = typeof m.scheduled_time === "string" ? m.scheduled_time.trim() : "";
  const dateIso = typeof m.date === "string" ? m.date : "";

  let ymd = scheduledDate;
  let timeKey = scheduledTime;

  if (!ymd && dateIso) {
    try {
      ymd = format(parseISO(dateIso), "yyyy-MM-dd");
    } catch {
      ymd = "";
    }
  }
  if (!timeKey && dateIso) {
    try {
      timeKey = format(parseISO(dateIso), "HH:mm");
    } catch {
      timeKey = "00:00";
    }
  }

  if (!timeKey) timeKey = "00:00";

  let dateLine = "—";
  if (ymd) {
    try {
      dateLine = format(parseISO(`${ymd}T12:00:00`), "EEE d MMM yyyy", { locale: es });
    } catch {
      dateLine = ymd;
    }
  }

  const timeLine = timeKey.length >= 5 ? timeKey.slice(0, 5) : timeKey;

  return { ymd, timeKey, dateLine, timeLine };
}

/**
 * Partidos donde el usuario está en `match_participants`, con fecha programada ≥ hoy (local).
 * Orden: fecha y hora ascendente.
 */
export async function fetchMyHomeReservations(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeReservationCard[]> {
  const { data, error } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select(
      `
      match_id,
      matches (
        id,
        date,
        scheduled_date,
        scheduled_time,
        match_type,
        courts (
          clubs ( name )
        ),
        match_participants ( player_id )
      )
    `
    )
    .eq("player_id", userId);

  if (error || !data?.length) {
    return [];
  }

  const today = todayLocalYmd();
  const withSort: { sortKey: string; card: HomeReservationCard }[] = [];

  for (const row of data as { matches: unknown }[]) {
    const m = unwrapMatch(row.matches);
    if (!m?.id) continue;

    const { ymd, timeKey, dateLine, timeLine } = effectiveSchedule(m);
    if (!ymd || ymd < today) continue;

    const rawType = String(m.match_type ?? "").toLowerCase().trim();
    const matchTypeLabel = rawType === "competitivo" ? "Competitivo" : "Amistoso";

    const n = participantCount(m);
    const slotsFilled = n;
    const slotsFree = Math.max(0, SLOTS_TOTAL - n);

    const paddedTime = timeKey.length >= 5 ? timeKey.slice(0, 5) : timeKey.padStart(5, "0");
    const sortKey = `${ymd}T${paddedTime}`;

    withSort.push({
      sortKey,
      card: {
        matchId: String(m.id),
        clubName: clubNameFromMatch(m),
        dateLine,
        timeLine,
        matchTypeLabel,
        slotsFilled,
        slotsFree,
      },
    });
  }

  withSort.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return withSort.map((x) => x.card);
}
