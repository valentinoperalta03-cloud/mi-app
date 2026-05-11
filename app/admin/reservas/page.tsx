import { addDays, format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { PaymentStatusPill, PlayerAvatar } from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { blockCourtSlotAction, cancelReservationAdmin, requestReservationRefundAction } from "./actions";

type CourtEmbed = { id: string; name: string | null };
type MatchRow = {
  id: string;
  date: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  court_id: string;
  owner_id: string | null;
  payment_status: string | null;
  total_price: number | null;
  match_status: string | null;
  location_name: string | null;
  match_type: string | null;
  es_turno_fijo: boolean | null;
  courts: CourtEmbed | null;
};
type BlockRow = {
  court_id: string;
  blocked_date: string | null;
  blocked_time: string | null;
  reason: string | null;
};

type PageProps = {
  searchParams: Promise<{ date?: string; selected?: string }>;
};

function getTimeFromMatch(m: MatchRow): string {
  if (m.scheduled_time) return String(m.scheduled_time).trim().slice(0, 5);
  try {
    return format(parseISO(m.date), "HH:mm");
  } catch {
    return "--:--";
  }
}

function getSlotBucket(m: MatchRow): string {
  const time = getTimeFromMatch(m);
  if (!/^\d{2}:\d{2}$/.test(time)) return "00:00";
  return time;
}

function durationMin(m: MatchRow): number {
  return m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : 90;
}

function buildSlots() {
  return ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00", "22:30"];
}

export default async function AdminReservasPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  if (ctx.clubIds.length === 0) {
    return (
      <div className={`${adminCard} border-amber-200/80 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40`}>
        <AdminBackLink />
        <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Sin club asignado.</p>
      </div>
    );
  }

  const selectedDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : getTodayYmdInArgentina();
  const selectedMatchId = sp.selected?.trim() ?? "";
  const previousDate = format(subDays(parseISO(`${selectedDate}T12:00:00`), 1), "yyyy-MM-dd");
  const nextDate = format(addDays(parseISO(`${selectedDate}T12:00:00`), 1), "yyyy-MM-dd");
  const todayDate = getTodayYmdInArgentina();

  const { data: matchesRaw, error: matchesError } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,date,scheduled_date,scheduled_time,duration_minutes,court_id,owner_id,payment_status,total_price,match_status,location_name,match_type,es_turno_fijo,courts(id,name)"
    )
    .in("court_id", ctx.courtIds)
    .eq("scheduled_date", selectedDate)
    .neq("match_status", "cancelled")
    .order("scheduled_time", { ascending: true });

  const matches = (matchesRaw ?? []) as unknown as MatchRow[];
  const { data: blocksRaw } = await supabase
    .from(DB_TABLES.courtBlocks)
    .select("court_id,blocked_date,blocked_time,reason")
    .in("court_id", ctx.courtIds)
    .eq("blocked_date", selectedDate);
  const blocks = (blocksRaw ?? []) as BlockRow[];

  const creatorIds = Array.from(new Set(matches.map((m) => m.owner_id).filter(Boolean))) as string[];
  const { data: profilesData } = creatorIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", creatorIds)
    : { data: [] };
  const nameByUser = new Map(
    (profilesData ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"])
  );

  const slotMap = new Map<string, MatchRow>();
  for (const m of matches) {
    const key = `${m.court_id}__${getSlotBucket(m)}`;
    if (!slotMap.has(key)) slotMap.set(key, m);
  }
  const blockMap = new Map<string, BlockRow>();
  for (const block of blocks) {
    const hour = String(block.blocked_time ?? "").trim().slice(0, 5);
    if (!hour) continue;
    const key = `${block.court_id}__${hour}`;
    blockMap.set(key, block);
  }

  const selectedMatch = selectedMatchId ? matches.find((m) => m.id === selectedMatchId) ?? null : null;
  const selectedMatchParticipantsRaw = selectedMatch
    ? await supabase
        .from(DB_TABLES.matchParticipants)
        .select("player_id,profiles(name,avatar_url)")
        .eq("match_id", selectedMatch.id)
    : { data: [] };
  const selectedMatchParticipants = ((selectedMatchParticipantsRaw.data ?? []) as Array<{
    player_id: string;
    profiles:
      | { name: string | null; avatar_url: string | null }
      | { name: string | null; avatar_url: string | null }[]
      | null;
  }>).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      playerId: row.player_id,
      name: profile?.name?.trim() || nameByUser.get(row.player_id) || "Jugador",
      avatarUrl: profile?.avatar_url ?? null,
    };
  });

  const reservationMatches = matches.filter((m) => String(m.match_type ?? "").toLowerCase() === "reservation");
  const totalReservas = reservationMatches.length;
  const paidReservas = reservationMatches.filter((m) => String(m.payment_status ?? "").toLowerCase() === "paid").length;
  const pendingReservas = reservationMatches.filter((m) => String(m.payment_status ?? "").toLowerCase() === "pending").length;

  const slots = buildSlots();
  const titleDate = format(parseISO(`${selectedDate}T12:00:00`), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />

      <header className={`${adminCard} relative overflow-hidden`}>
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#0585FC]/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className={`${adminKicker} text-[#0585FC]`}>Agenda diaria</p>
            <h1 className={adminTitle}>Gestión de reservas</h1>
            <p className={adminSubtitle}>Vista calendario por canchas para operar el día sin fricción.</p>
          </div>
        </div>
      </header>

      <section className={`${adminCard} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link
            href={`/admin/reservas?date=${previousDate}`}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            ← Anterior
          </Link>
          <Link
            href={`/admin/reservas?date=${todayDate}`}
            className="rounded-full border border-[#0585FC]/30 bg-[#0585FC]/10 px-3 py-1 text-[#0461C4] transition hover:bg-[#0585FC]/20 dark:text-sky-300"
          >
            Hoy
          </Link>
          <Link
            href={`/admin/reservas?date=${nextDate}`}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Siguiente →
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={adminKicker}>Fecha seleccionada</p>
            <p className="mt-1 text-lg font-semibold capitalize text-slate-900 dark:text-slate-100">{titleDate}</p>
          </div>
          <form className="flex items-center gap-2">
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ver día
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className={adminCard}>
          <p className={adminKicker}>Total reservas del día</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalReservas}</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Pagadas</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{paidReservas}</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Pendientes de pago</p>
          <p className="mt-2 text-2xl font-bold text-amber-500">{pendingReservas}</p>
        </div>
      </section>

      {matchesError ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-6 text-sm font-medium text-rose-800">
          Error al cargar reservas: {matchesError.message}.
        </div>
      ) : (
        <section className={`${adminCard} overflow-hidden p-0`}>
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div
                className="grid border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40"
                style={{ gridTemplateColumns: `84px repeat(${ctx.courts.length}, minmax(180px, 1fr))` }}
              >
                <div className="sticky left-0 z-20 border-r border-slate-200/80 bg-slate-50/95 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  Hora
                </div>
                {ctx.courts.map((court) => (
                  <div
                    key={court.id}
                    className="border-r border-slate-200/70 px-3 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    {court.name ?? "Cancha"}
                  </div>
                ))}
              </div>

              {slots.map((slot) => (
                <div
                  key={slot}
                  className="grid border-b border-slate-100/90 dark:border-slate-800"
                  style={{ gridTemplateColumns: `84px repeat(${ctx.courts.length}, minmax(180px, 1fr))` }}
                >
                  <div className="sticky left-0 z-10 border-r border-slate-200/70 bg-white px-3 py-4 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                    {slot}
                  </div>
                  {ctx.courts.map((court) => {
                    const slotKey = `${court.id}__${slot}`;
                    const reservation = slotMap.get(slotKey);
                    const blocked = blockMap.get(slotKey);
                    if (!reservation) {
                      return (
                        <div
                          key={slotKey}
                          className="min-h-16 border-r border-slate-100/90 bg-slate-50/70 px-2 py-2 dark:border-slate-800 dark:bg-slate-900/20"
                        >
                          {blocked ? (
                            <form action={blockCourtSlotAction} className="h-full rounded-xl border border-rose-200 bg-rose-100/90 p-2 dark:border-rose-800 dark:bg-rose-950/30">
                              <input type="hidden" name="court_id" value={court.id} />
                              <input type="hidden" name="date" value={selectedDate} />
                              <input type="hidden" name="time" value={slot} />
                              <button type="submit" className="w-full rounded-lg bg-rose-600 px-2 py-2 text-xs font-semibold text-white">
                                Bloqueado
                              </button>
                              <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                                {blocked.reason ? blocked.reason : "Toque para desbloquear"}
                              </p>
                            </form>
                          ) : (
                            <details className="h-full rounded-xl border border-dashed border-slate-200/80 bg-slate-100/60 p-2 dark:border-slate-700 dark:bg-slate-900/40">
                              <summary className="cursor-pointer list-none text-center text-[11px] font-semibold text-slate-600 [&::-webkit-details-marker]:hidden dark:text-slate-300">
                                Bloquear horario
                              </summary>
                              <form action={blockCourtSlotAction} className="mt-2 space-y-2">
                                <input type="hidden" name="court_id" value={court.id} />
                                <input type="hidden" name="date" value={selectedDate} />
                                <input type="hidden" name="time" value={slot} />
                                <input
                                  type="text"
                                  name="reason"
                                  placeholder="Motivo (opcional)"
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                />
                                <button
                                  type="submit"
                                  className="w-full rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white"
                                >
                                  Confirmar
                                </button>
                              </form>
                            </details>
                          )}
                        </div>
                      );
                    }
                    const player = reservation.owner_id ? nameByUser.get(reservation.owner_id) ?? "Jugador" : "Sin asignar";
                    const isReservation = String(reservation.match_type ?? "").toLowerCase() === "reservation";
                    const payNorm = String(reservation.payment_status ?? "").toLowerCase();
                    const paidReservation = isReservation && payNorm === "paid";
                    const pendingReservation = isReservation && payNorm === "pending";
                    const cardClass = paidReservation
                      ? "border-emerald-600 bg-emerald-500"
                      : pendingReservation
                        ? "border-amber-500 bg-amber-400"
                        : "border-[#0585FC]/20 bg-[#0585FC]";
                    const statusText = paidReservation
                      ? "✓ Pagado"
                      : pendingReservation
                        ? "⚠ Pendiente"
                        : isReservation
                          ? "Reserva"
                          : "Partido abierto";
                    return (
                      <Link
                        key={slotKey}
                        href={`/admin/reservas?date=${selectedDate}&selected=${reservation.id}`}
                        className="block min-h-16 border-r border-slate-100/90 px-2 py-2 transition-all duration-200 hover:bg-slate-100/70 dark:border-slate-800 dark:hover:bg-slate-900/30"
                      >
                        <div className={`rounded-xl border px-3 py-2 text-white shadow-sm ${cardClass}`}>
                          <p className="truncate text-sm font-semibold">{player}</p>
                          <p className="text-xs opacity-90">{getTimeFromMatch(reservation)}</p>
                          <p className="text-xs font-semibold">{statusText}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedMatch ? (
        <section className={`${adminCard} border-[#0585FC]/20 bg-[#0585FC]/5 dark:bg-slate-900/40`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <PlayerAvatar
                name={selectedMatch.owner_id ? nameByUser.get(selectedMatch.owner_id) ?? "Jugador" : "Sin asignar"}
              />
              <div>
                <p className={adminKicker}>Detalle de reserva</p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedMatch.owner_id ? nameByUser.get(selectedMatch.owner_id) ?? "Jugador" : "Sin asignar"}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedMatch.es_turno_fijo ? (
                <span className="inline-flex rounded-full border border-[#0585FC]/30 bg-[#0585FC]/10 px-2 py-1 text-xs font-semibold text-[#0461C4] dark:text-sky-300">
                  🔄 Turno fijo
                </span>
              ) : null}
              <PaymentStatusPill status={String(selectedMatch.payment_status ?? "—")} />
            </div>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Cancha</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {selectedMatch.courts?.name ?? ctx.courts.find((c) => c.id === selectedMatch.court_id)?.name ?? "Cancha"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Horario</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{getTimeFromMatch(selectedMatch)}</dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Duración</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{durationMin(selectedMatch)} min</dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Monto</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {selectedMatch.total_price != null ? `$${Number(selectedMatch.total_price).toFixed(2)}` : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Precio por jugador</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {selectedMatch.total_price != null ? `$${(Number(selectedMatch.total_price) / 4).toFixed(2)}` : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className={adminKicker}>Jugadores</p>
            {selectedMatchParticipants.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin jugadores asignados aún.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedMatchParticipants.map((player) => (
                  <li key={player.playerId} className="flex items-center gap-2">
                    {player.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                      <img src={player.avatarUrl} alt={player.name} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <PlayerAvatar name={player.name} />
                    )}
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{player.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              {["paid", "pending"].includes(String(selectedMatch.payment_status ?? "").toLowerCase()) &&
              String(selectedMatch.match_type ?? "").toLowerCase() === "reservation" ? (
                <form action={cancelReservationAdmin}>
                  <input type="hidden" name="match_id" value={selectedMatch.id} />
                  <input type="hidden" name="date" value={selectedDate} />
                  <button
                    type="submit"
                    className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100"
                  >
                    Cancelar reserva
                  </button>
                </form>
              ) : null}
              {String(selectedMatch.payment_status ?? "").toLowerCase() === "paid" &&
              String(selectedMatch.match_type ?? "").toLowerCase() === "reservation" ? (
                <form action={requestReservationRefundAction}>
                  <input type="hidden" name="match_id" value={selectedMatch.id} />
                  <input type="hidden" name="date" value={selectedDate} />
                  <button
                    type="submit"
                    className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    Solicitar reembolso
                  </button>
                </form>
              ) : null}
              <Link
                href={`/admin/reservas?date=${selectedDate}`}
                className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Cerrar detalle
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
