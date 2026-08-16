import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MatchesRealtimeRefresh } from "@/components/matches-realtime-refresh";
import MotionPage from "@/components/motion-page";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ReservasTabs, {
  type FixedSlotEntry,
  type OpenMatchRow,
  type ReservationRow,
} from "./reservas-tabs-client";

function todayKey() {
  return getTodayYmdInArgentina();
}

const ERROR_MESSAGES: Record<string, string> = {
  cancel: "No se pudo cancelar la reserva. Intentá de nuevo.",
  mp_reembolso:
    "No pudimos procesar el reembolso con Mercado Pago. Contactá soporte o intentá más tarde.",
};

const INFO_MESSAGES: Record<string, string> = {
  sin_reembolso:
    "Reserva cancelada. No aplica reembolso automático porque falta menos de una hora para el horario.",
};

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const urlError = sp.error?.trim();
  const urlInfo = sp.info?.trim();
  const urlErrorMessage = urlError ? ERROR_MESSAGES[urlError] ?? null : null;
  const urlInfoMessage = urlInfo ? INFO_MESSAGES[urlInfo] ?? null : null;
  const defaultTab = sp.tab?.trim() === "partidos" ? "partidos" : "canchas";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const today = todayKey();

  const { data: rows, error } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id, court_id, scheduled_date, scheduled_time, duration_minutes, total_price, match_status, financial_status, match_type"
    )
    .eq("owner_id", user.id)
    .eq("match_type", "reservation")
    .order("scheduled_date", { ascending: false });

  const rawList = rows ?? [];
  const courtIds = [...new Set(rawList.map((r: { court_id: string }) => r.court_id))];
  const { data: courtsJoin } =
    courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courts)
          .select("id, name, club_id, clubs ( name )")
          .in("id", courtIds)
      : { data: [] };

  const courtMap = new Map<string, { name: string | null; clubs: { name: string | null } | null }>();
  for (const c of courtsJoin ?? []) {
    const row = c as {
      id: string;
      name: string | null;
      clubs: { name: string | null } | { name: string | null }[] | null;
    };
    const clubRel = row.clubs;
    const clubObj = Array.isArray(clubRel) ? clubRel[0] ?? null : clubRel;
    courtMap.set(row.id, { name: row.name, clubs: clubObj });
  }

  const list: ReservationRow[] = rawList.map((r: Record<string, unknown>) => {
    const cid = String(r.court_id ?? "");
    const embed = courtMap.get(cid) ?? null;
    return {
      ...(r as unknown as ReservationRow),
      courts: embed ? { name: embed.name, clubs: embed.clubs } : null,
    };
  });

  // ── Turno fijo participations ─────────────────────────────────────
  const { data: fixedParticipantRows } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id, attendance_status")
    .eq("player_id", user.id);

  const fixedParticipantMatchIds = (
    (fixedParticipantRows ?? []) as Array<{ match_id: string }>
  ).map((p) => p.match_id);

  const { data: fixedMatchRows } =
    fixedParticipantMatchIds.length > 0
      ? await supabase
          .from(DB_TABLES.matches)
          .select("id, scheduled_date, scheduled_time, duration_minutes, court_id, match_status")
          .in("id", fixedParticipantMatchIds)
          .eq("es_turno_fijo", true)
          .neq("match_status", "cancelled")
          .gte("scheduled_date", today)
          .order("scheduled_date", { ascending: true })
      : { data: [] };

  const fixedCourtIds = [
    ...new Set(
      ((fixedMatchRows ?? []) as Array<{ court_id: string }>).map((r) => r.court_id)
    ),
  ];
  const { data: fixedCourtsJoin } =
    fixedCourtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courts)
          .select("id, name, clubs ( name, fixed_slot_confirmation_hours )")
          .in("id", fixedCourtIds)
      : { data: [] };

  const fixedCourtMap = new Map<
    string,
    { name: string | null; clubName: string | null; confirmationHours: number }
  >();
  for (const c of fixedCourtsJoin ?? []) {
    const row = c as {
      id: string;
      name: string | null;
      clubs:
        | { name: string | null; fixed_slot_confirmation_hours?: number | null }
        | Array<{ name: string | null; fixed_slot_confirmation_hours?: number | null }>
        | null;
    };
    const clubRel = row.clubs;
    const clubObj = Array.isArray(clubRel) ? (clubRel[0] ?? null) : clubRel;
    fixedCourtMap.set(row.id, {
      name: row.name,
      clubName: clubObj?.name ?? null,
      confirmationHours: Number(clubObj?.fixed_slot_confirmation_hours ?? 24),
    });
  }

  const participationStatusMap = new Map<string, string | null>();
  for (const p of (fixedParticipantRows ?? []) as Array<{
    match_id: string;
    attendance_status: string | null;
  }>) {
    participationStatusMap.set(p.match_id, p.attendance_status);
  }

  const nowMs = Date.now();
  const fixedSlots: FixedSlotEntry[] = (
    (fixedMatchRows ?? []) as Array<{
      id: string;
      scheduled_date: string | null;
      scheduled_time: string | null;
      duration_minutes: number | null;
      court_id: string;
    }>
  ).map((m) => {
    const courtInfo = fixedCourtMap.get(m.court_id) ?? null;
    const confirmationHours = courtInfo?.confirmationHours ?? 24;
    const dateStr = m.scheduled_date ?? "";
    const timeStr = String(m.scheduled_time ?? "").slice(0, 5);
    const matchTimeAr =
      dateStr && timeStr ? new Date(`${dateStr}T${timeStr}:00-03:00`) : null;
    const deadlineMs = matchTimeAr
      ? matchTimeAr.getTime() - confirmationHours * 3_600_000
      : 0;
    return {
      matchId: m.id,
      scheduledDate: dateStr,
      scheduledTime: timeStr || "—",
      durationMinutes: m.duration_minutes ?? 90,
      courtName: courtInfo?.name ?? "Cancha",
      clubName: courtInfo?.clubName ?? "Club",
      attendanceStatus: participationStatusMap.get(m.id) ?? null,
      deadlinePassed: nowMs >= deadlineMs,
    };
  });
  // ─────────────────────────────────────────────────────────────────

  // ── Partidos abiertos donde el jugador participa ──────────────────
  const { data: openMatchParticipations } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("player_id", user.id);

  const openMatchIds = ((openMatchParticipations ?? []) as Array<{ match_id: string }>).map(
    (p) => p.match_id
  );

  const { data: openMatchRows } =
    openMatchIds.length > 0
      ? await supabase
          .from(DB_TABLES.matches)
          .select(
            "id, scheduled_date, scheduled_time, duration_minutes, match_status, match_type, courts(name, clubs(name))"
          )
          .in("id", openMatchIds)
          .eq("match_type", "amistoso")
          .neq("match_status", "cancelled")
          .order("scheduled_date", { ascending: true })
      : { data: [] };

  const openMatches: OpenMatchRow[] = ((openMatchRows ?? []) as Array<Record<string, unknown>>).map(
    (row) => {
      const courtsRel = row.courts as
        | { name: string | null; clubs: { name: string | null } | { name: string | null }[] | null }
        | { name: string | null; clubs: { name: string | null } | { name: string | null }[] | null }[]
        | null;
      const courtObj = Array.isArray(courtsRel) ? courtsRel[0] ?? null : courtsRel;
      const clubRel = courtObj?.clubs ?? null;
      const clubObj = Array.isArray(clubRel) ? clubRel[0] ?? null : clubRel;
      return {
        id: String(row.id),
        scheduled_date: (row.scheduled_date as string | null) ?? null,
        scheduled_time: (row.scheduled_time as string | null) ?? null,
        duration_minutes: (row.duration_minutes as number | null) ?? null,
        match_status: (row.match_status as string | null) ?? null,
        match_type: (row.match_type as string | null) ?? null,
        courts: courtObj ? { name: courtObj.name, clubs: clubObj } : null,
      };
    }
  );
  // ─────────────────────────────────────────────────────────────────

  const upcoming = list.filter((r) => {
    const d = r.scheduled_date ?? "";
    return d >= today && r.match_status === "reserved" && (r.financial_status ?? "unpaid") !== "unpaid";
  });
  const pending = list.filter((r) => {
    const d = r.scheduled_date ?? "";
    return d >= today && r.match_status === "reserved" && (r.financial_status ?? "unpaid") === "unpaid";
  });

  const history = list.filter((r) => {
    const d = r.scheduled_date ?? "";
    return d < today || r.match_status === "cancelled";
  });

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <MatchesRealtimeRefresh channelName={`reservas-live:${user.id}`} filter={`owner_id=eq.${user.id}`} />
      <header className="space-y-1">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0085FC] transition hover:text-[#0461C4]"
        >
          <ArrowLeft className="h-4 w-4" />
          Inicio
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Mis reservas</h1>
        <p className="text-sm font-light text-[var(--text-tertiary)]">
          Tus canchas reservadas y partidos activos
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error.message}</div>
      ) : null}

      {!error && urlErrorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{urlErrorMessage}</div>
      ) : null}

      {!error && urlInfoMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{urlInfoMessage}</div>
      ) : null}

      {!error ? (
        <ReservasTabs
          defaultTab={defaultTab}
          fixedSlots={fixedSlots}
          upcoming={upcoming}
          pending={pending}
          history={history}
          hasAnyReservation={list.length > 0}
          openMatches={openMatches}
        />
      ) : null}
    </MotionPage>
  );
}
