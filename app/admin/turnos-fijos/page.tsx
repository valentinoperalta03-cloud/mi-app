import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { addExceptionToFixedSlot, deleteFixedSlot, removeException, saveFixedSlotSettings } from "./actions";
import AddPlayerInline from "./add-player-inline";
import TurnosFijosForm from "./turnos-form";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function nextDateForDay(dayOfWeek: number, fromDate = new Date()) {
  const base = new Date(fromDate);
  base.setHours(12, 0, 0, 0);
  const delta = (dayOfWeek - base.getDay() + 7) % 7;
  return addDays(base, delta);
}

function attendanceLabel(status: string | null | undefined) {
  if (status === "confirmed") return "✅ Confirmado";
  if (status === "declined") return "❌ No va";
  return "⏳ Sin confirmar";
}

type PageProps = {
  searchParams?: Promise<{ fixed_saved?: string; fixed_error?: string }>;
};

export default async function AdminTurnosFijosPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const fixedOk = sp.fixed_saved === "1";
  const fixedErr = sp.fixed_error ? decodeURIComponent(sp.fixed_error) : "";

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: clubRow } = ctx.clubIds.length
    ? await supabase
        .from(DB_TABLES.clubs)
        .select("fixed_slot_confirmation_hours")
        .eq("id", ctx.clubIds[0])
        .maybeSingle()
    : { data: null };
  const confirmationHours = Number(
    (clubRow as { fixed_slot_confirmation_hours?: number | null } | null)?.fixed_slot_confirmation_hours ?? 24
  );

  const { data: slotsRaw } = ctx.clubIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlots)
        .select("id,club_id,court_id,day_of_week,start_time,duration_minutes,is_active,created_at")
        .in("club_id", ctx.clubIds)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true })
    : { data: [] };
  const slots = (slotsRaw ?? []) as Array<{
    id: string;
    club_id: string;
    court_id: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    is_active: boolean;
    created_at: string;
  }>;

  const slotIds = slots.map((s) => s.id);
  const { data: slotPlayersRaw } = slotIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlotPlayers)
        .select("fixed_slot_id,player_id")
        .in("fixed_slot_id", slotIds)
    : { data: [] };
  const slotPlayers = (slotPlayersRaw ?? []) as Array<{
    fixed_slot_id: string;
    player_id: string;
  }>;

  const playerIds = Array.from(new Set(slotPlayers.map((p) => p.player_id)));
  const { data: profilesData } = playerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name,avatar_url").in("user_id", playerIds)
    : { data: [] };
  const profileById = new Map(
    (profilesData ?? []).map((p: { user_id: string; name: string | null; avatar_url: string | null }) => [
      p.user_id,
      { name: p.name ?? "Jugador", avatarUrl: p.avatar_url ?? null },
    ])
  );

  const playersBySlot = new Map<string, Array<{ playerId: string; name: string; avatarUrl: string | null }>>();
  for (const p of slotPlayers) {
    const list = playersBySlot.get(p.fixed_slot_id) ?? [];
    const profile = profileById.get(p.player_id);
    list.push({
      playerId: p.player_id,
      name: profile?.name ?? "Jugador",
      avatarUrl: profile?.avatarUrl ?? null,
    });
    playersBySlot.set(p.fixed_slot_id, list);
  }

  const today = new Date();
  const todayYmd = format(today, "yyyy-MM-dd");
  const nextDateBySlot = new Map<string, string>();
  for (const slot of slots) {
    const nextDate = nextDateForDay(slot.day_of_week, today);
    nextDateBySlot.set(slot.id, format(nextDate, "yyyy-MM-dd"));
  }
  const nextDates = Array.from(new Set(nextDateBySlot.values()));

  const { data: generatedMatchesRaw } = slotIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id,fixed_slot_id,scheduled_date,scheduled_time,es_turno_fijo")
        .eq("es_turno_fijo", true)
        .in("fixed_slot_id", slotIds)
        .in("scheduled_date", nextDates)
    : { data: [] };
  const generatedMatches = (generatedMatchesRaw ?? []) as Array<{
    id: string;
    fixed_slot_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    es_turno_fijo: boolean | null;
  }>;
  const matchBySlotAndDate = new Map<string, (typeof generatedMatches)[number]>();
  for (const m of generatedMatches) {
    const key = `${m.fixed_slot_id ?? ""}__${m.scheduled_date ?? ""}`;
    matchBySlotAndDate.set(key, m);
  }

  const nextMatchIds = generatedMatches.map((m) => m.id);
  const { data: nextMatchParticipantsRaw } = nextMatchIds.length
    ? await supabase
        .from(DB_TABLES.matchParticipants)
        .select("match_id,player_id,attendance_status")
        .in("match_id", nextMatchIds)
    : { data: [] };
  const attendanceByMatchPlayer = new Map<string, string | null>();
  for (const p of (nextMatchParticipantsRaw ?? []) as Array<{
    match_id: string;
    player_id: string;
    attendance_status: string | null;
  }>) {
    attendanceByMatchPlayer.set(`${p.match_id}__${p.player_id}`, p.attendance_status ?? null);
  }

  const { data: exceptionsRaw } = slotIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlotExceptions)
        .select("id,fixed_slot_id,exception_date,reason")
        .in("fixed_slot_id", slotIds)
        .gte("exception_date", todayYmd)
        .order("exception_date", { ascending: true })
    : { data: [] };
  const exceptions = (exceptionsRaw ?? []) as Array<{
    id: string;
    fixed_slot_id: string;
    exception_date: string;
    reason: string | null;
  }>;
  const exceptionsBySlot = new Map<string, Array<(typeof exceptions)[number]>>();
  for (const ex of exceptions) {
    const list = exceptionsBySlot.get(ex.fixed_slot_id) ?? [];
    list.push(ex);
    exceptionsBySlot.set(ex.fixed_slot_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Operación semanal</p>
        <h1 className={adminTitle}>Turnos fijos</h1>
        <p className={adminSubtitle}>Configurá turnos semanales por cancha y asigná jugadores.</p>
      </header>

      <section className={`${adminCard} p-5`}>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Confirmación de asistencia</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Con cuántas horas de anticipación los jugadores deben confirmar asistencia. Aplica a todos los turnos del club.
        </p>
        {fixedOk ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            Cambios guardados.
          </p>
        ) : fixedErr ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            {fixedErr}
          </p>
        ) : null}
        <form action={saveFixedSlotSettings} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Horas de anticipación
            <input
              name="fixed_slot_confirmation_hours"
              type="number"
              min="1"
              max="168"
              required
              defaultValue={confirmationHours}
              className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-[#0585FC] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
          >
            Guardar
          </button>
        </form>
      </section>

      <section className={adminCard}>
        <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">Agregar turno fijo</h2>
        <TurnosFijosForm courts={ctx.courts.map((c) => ({ id: c.id, name: c.name }))} />
      </section>

      <section className={adminCard}>
        <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">Turnos activos</h2>
        {slots.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no hay turnos fijos configurados.</p>
        ) : (
          <ul className="space-y-4">
            {slots.map((slot) => {
              const players = playersBySlot.get(slot.id) ?? [];
              const courtName = ctx.courts.find((c) => c.id === slot.court_id)?.name ?? "Cancha";
              const nextDateYmd = nextDateBySlot.get(slot.id) ?? todayYmd;
              const nextDateObj = parseISO(`${nextDateYmd}T12:00:00`);
              const nextDateLabel = `${DAY_LABELS[slot.day_of_week] ?? "Día"} ${format(nextDateObj, "d 'de' MMMM", {
                locale: es,
              })}`;
              const nextMatch = matchBySlotAndDate.get(`${slot.id}__${nextDateYmd}`) ?? null;
              const slotExceptions = exceptionsBySlot.get(slot.id) ?? [];

              return (
                <li
                  key={slot.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {DAY_LABELS[slot.day_of_week] ?? "Día"} · {String(slot.start_time).slice(0, 5)} · {slot.duration_minutes} min
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{courtName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#0585FC]/10 px-3 py-1 text-xs font-semibold text-[#0461C4] dark:text-sky-300">
                        Próximo: {nextDateLabel} · {String(slot.start_time).slice(0, 5)}hs
                      </span>
                      <form action={deleteFixedSlot}>
                        <input type="hidden" name="fixed_slot_id" value={slot.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          Desactivar
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
                    <div className="space-y-2">
                      {Array.from({ length: 2 }, (_, i) => {
                        const player = players[i];
                        if (!player) {
                          return (
                            <div
                              key={`${slot.id}-left-empty-${i}`}
                              className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400"
                            >
                              Libre
                            </div>
                          );
                        }
                        return (
                          <div
                            key={`${slot.id}-${player.playerId}`}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                          >
                            {player.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                              <img src={player.avatarUrl} alt={player.name} className="h-7 w-7 rounded-full object-cover" />
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                {player.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{player.name}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex h-full items-center justify-center pt-4">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        VS
                      </span>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: 2 }, (_, i) => {
                        const player = players[i + 2];
                        if (!player) {
                          return (
                            <div
                              key={`${slot.id}-right-empty-${i}`}
                              className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400"
                            >
                              Libre
                            </div>
                          );
                        }
                        return (
                          <div
                            key={`${slot.id}-${player.playerId}`}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                          >
                            {player.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                              <img src={player.avatarUrl} alt={player.name} className="h-7 w-7 rounded-full object-cover" />
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                {player.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{player.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Estado de confirmación semanal
                    </p>
                    {!nextMatch ? (
                      <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Reserva aún no generada</p>
                    ) : players.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin jugadores asignados.</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {players.map((player) => {
                          const attendance = attendanceByMatchPlayer.get(`${nextMatch.id}__${player.playerId}`);
                          return (
                            <li key={`${slot.id}-status-${player.playerId}`} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-200">{player.name}</span>
                              <span className="font-semibold">{attendanceLabel(attendance)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {players.length < 4 ? <AddPlayerInline fixedSlotId={slot.id} /> : null}

                  <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Excepciones activas ({slotExceptions.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {slotExceptions.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No hay excepciones futuras.</p>
                      ) : (
                        <ul className="space-y-2">
                          {slotExceptions.map((ex) => (
                            <li
                              key={ex.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                            >
                              <span className="text-slate-700 dark:text-slate-200">
                                📅 Sin turno el {format(parseISO(`${ex.exception_date}T12:00:00`), "dd/MM", { locale: es })}
                                {ex.reason ? ` — ${ex.reason}` : ""}
                              </span>
                              <form action={removeException}>
                                <input type="hidden" name="exception_id" value={ex.id} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                                >
                                  Eliminar
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form action={addExceptionToFixedSlot} className="mt-3 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="fixed_slot_id" value={slot.id} />
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Fecha excepción
                          <input
                            name="exception_date"
                            type="date"
                            required
                            className="mt-1 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Motivo
                          <input
                            name="reason"
                            placeholder="Opcional"
                            className="mt-1 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
                        >
                          Agregar excepción
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
