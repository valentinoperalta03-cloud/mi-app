import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { Badge } from "@/components/ui/badge";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD_INTERACTIVE, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";
import { cancelReservation, confirmFixedSlotAttendance, declineFixedSlotAttendance } from "./actions";

type ReservationRow = {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  total_price: number | null;
  match_status: string | null;
  courts: { name: string | null; clubs: { name: string | null } | null } | null;
};

function todayKey() {
  return getTodayYmdInArgentina();
}

function ReservationCard({
  row,
  showCancel,
}: {
  row: ReservationRow;
  showCancel: boolean;
}) {
  const club = row.courts?.clubs?.name ?? "Club";
  const court = row.courts?.name ?? "Cancha";
  const dateStr = row.scheduled_date ?? "";
  const fecha =
    dateStr.length >= 10
      ? format(parseISO(`${dateStr}T12:00:00`), "EEE d MMM yyyy", { locale: es })
      : "—";
  const hora = (row.scheduled_time ?? "").toString().trim().slice(0, 5);
  const dur = row.duration_minutes ?? 90;
  const precio = row.total_price != null ? `$${Math.round(Number(row.total_price)).toLocaleString("es-AR")}` : "—";
  const status = row.match_status ?? "";
  const badgeReserved = status === "reserved";
  const badgePending = status === "pending";
  const badgeCancelled = status === "cancelled";

  return (
    <article className={`${PLAYER_CARD_INTERACTIVE} w-full overflow-hidden rounded-2xl p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-slate-950">{club}</h2>
          <p className="truncate text-sm font-medium text-[var(--text-tertiary)]">{court}</p>
        </div>
        {badgeReserved ? (
          <Badge variant="success" className="shrink-0">
            Confirmada
          </Badge>
        ) : badgePending ? (
          <Badge variant="warning" className="shrink-0">
            Pendiente de pago
          </Badge>
        ) : badgeCancelled ? (
          <Badge variant="neutral" className="shrink-0">
            Cancelada
          </Badge>
        ) : (
          (() => {
            const normalized = (status || "").toLowerCase();
            if (normalized.includes("compet")) {
              return (
                <Badge variant="brand">
                  Competitivo
                </Badge>
              );
            }
            if (normalized.includes("amist")) {
              return (
                <Badge variant="brand">
                  Amistoso
                </Badge>
              );
            }
            if (normalized.includes("nivel")) {
              return (
                <Badge variant="warning">
                  Nivel restringido 🎯
                </Badge>
              );
            }
            return (
              <Badge variant="neutral" className="shrink-0">
                {status || "—"}
              </Badge>
            );
          })()
        )}
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-[var(--text-tertiary)]">
        <div className="flex justify-between">
          <dt className="text-[var(--text-tertiary)]">Fecha</dt>
          <dd className="font-semibold capitalize text-[var(--text-primary)]">{fecha}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--text-tertiary)]">Hora</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{hora || "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--text-tertiary)]">Duración</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{dur} min</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--text-tertiary)]">Precio</dt>
          <dd className="shrink-0 font-bold text-[#0585FC]">{precio}</dd>
        </div>
      </dl>
      {showCancel && badgeReserved ? (
        <form action={cancelReservation} className="mt-4">
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className="w-full rounded-2xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            Cancelar
          </button>
        </form>
      ) : null}
    </article>
  );
}

type FixedSlotEntry = {
  matchId: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  courtName: string;
  clubName: string;
  attendanceStatus: string | null;
  deadlinePassed: boolean;
};

function FixedSlotCard({ slot }: { slot: FixedSlotEntry }) {
  const dateStr = slot.scheduledDate;
  const fecha =
    dateStr.length >= 10
      ? format(parseISO(`${dateStr}T12:00:00`), "EEE d MMM yyyy", { locale: es })
      : "—";
  const confirmed = slot.attendanceStatus === "confirmed";

  return (
    <article className={`${PLAYER_CARD_INTERACTIVE} w-full overflow-hidden rounded-2xl p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-slate-950">{slot.clubName}</h2>
          <p className="truncate text-sm font-medium text-[var(--text-tertiary)]">{slot.courtName}</p>
        </div>
        <Badge variant="brand" className="shrink-0">
          Turno fijo
        </Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-[var(--text-tertiary)]">
        <div className="flex justify-between">
          <dt>Fecha</dt>
          <dd className="font-semibold capitalize text-[var(--text-primary)]">{fecha}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Hora</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{slot.scheduledTime}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Duración</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{slot.durationMinutes} min</dd>
        </div>
      </dl>
      <div className="mt-4">
        {confirmed ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-700">
            Confirmaste tu asistencia
          </p>
        ) : slot.deadlinePassed ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm text-slate-500">
            Plazo de confirmación vencido
          </p>
        ) : (
          <div className="flex gap-2">
            <form action={confirmFixedSlotAttendance} className="flex-1">
              <input type="hidden" name="match_id" value={slot.matchId} />
              <button
                type="submit"
                className="w-full rounded-xl bg-[#0585FC] py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Confirmo asistencia
              </button>
            </form>
            <form action={declineFixedSlotAttendance} className="flex-1">
              <input type="hidden" name="match_id" value={slot.matchId} />
              <button
                type="submit"
                className="w-full rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                No voy
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
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
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const sp = await searchParams;
  const urlError = sp.error?.trim();
  const urlInfo = sp.info?.trim();
  const urlErrorMessage = urlError ? ERROR_MESSAGES[urlError] ?? null : null;
  const urlInfoMessage = urlInfo ? INFO_MESSAGES[urlInfo] ?? null : null;

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
    .select("id, court_id, scheduled_date, scheduled_time, duration_minutes, total_price, match_status, match_type")
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

  const upcoming = list.filter((r) => {
    const d = r.scheduled_date ?? "";
    return (d >= today && r.match_status === "reserved") || false;
  });
  const pending = list.filter((r) => {
    const d = r.scheduled_date ?? "";
    return (d >= today && r.match_status === "pending") || false;
  });

  const history = list.filter((r) => {
    const d = r.scheduled_date ?? "";
    return d < today || r.match_status === "cancelled";
  });

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <header className="space-y-1">
        <p className="text-sm font-medium text-[#0585FC]">Reservas</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-950">Mis reservas</h1>
        <p className="text-sm font-light text-[var(--text-tertiary)]">Canchas que reservaste con FaltaUno.</p>
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

      {!error && list.length === 0 ? (
        <EmptyStateCard
          icon="calendar"
          title="Sin reservas todavía"
          subtitle="Reservá una cancha y aparecerá acá"
          ctaHref="/reservas/nueva"
          ctaLabel="Hacer una reserva"
        />
      ) : null}

      {!error && fixedSlots.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Turnos fijos</h2>
          <div className="space-y-3">
            {fixedSlots.map((slot) => (
              <FixedSlotCard key={slot.matchId} slot={slot} />
            ))}
          </div>
        </section>
      ) : null}

      {!error && upcoming.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Próximas</h2>
          <div className="space-y-3">
            {upcoming.map((r) => (
              <ReservationCard key={r.id} row={r} showCancel />
            ))}
          </div>
        </section>
      ) : null}

      {!error && pending.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Pendientes de pago</h2>
          <div className="space-y-3">
            {pending.map((r) => (
              <ReservationCard key={r.id} row={r} showCancel />
            ))}
          </div>
        </section>
      ) : null}

      {!error && history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Historial</h2>
          <div className="space-y-3">
            {history.map((r) => (
              <ReservationCard key={r.id} row={r} showCancel={false} />
            ))}
          </div>
        </section>
      ) : null}

      <Link href="/clubes" className={`inline-flex justify-center ${PLAYER_PRIMARY_BUTTON} w-full py-3`}>
        Buscar clubes para reservar
      </Link>
    </MotionPage>
  );
}
