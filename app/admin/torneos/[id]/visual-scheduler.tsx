"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminBadgeLima, adminButtonSecondary, adminCTAPrimary } from "@/components/admin/admin-premium";
import { assignTournamentMatchSlot, updateTournamentAvailabilityAction, type TournamentSlot } from "./actions";

export type SchedulerMatch = {
  id: string;
  label: string;
  categoryLabel: string;
  pair1Id: string | null;
  pair2Id: string | null;
  pair1Name: string;
  pair2Name: string;
  status: string;
  courtId: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  feederLeftMatchId: string | null;
  feederRightMatchId: string | null;
};

const DEFAULT_SLOT_MINUTES = 90;

/**
 * Editor visual de programación (sección 12): vista día × cancha con
 * drag-and-drop en escritorio y selección táctil en celular. Reusa
 * assignTournamentMatchSlot (misma RPC/lock que el resto del scheduler) para
 * cada movimiento — este componente no decide si un horario es válido, solo
 * arma candidatos y deja que el server confirme o rechace. Antes de llamar
 * al server valida en el cliente lo que la RPC no puede ver por sí sola:
 * que la pareja no quede jugando dos partidos a la vez, y que un partido no
 * se programe antes que los partidos de los que depende (feeders de cuadro
 * todavía no jugados).
 */
export function VisualScheduler({
  tournamentId,
  clubId,
  courts,
  matches,
  poolSlots,
}: {
  tournamentId: string;
  clubId: string;
  courts: Array<{ id: string; name: string }>;
  matches: SchedulerMatch[];
  poolSlots: Array<{ date: string; courtId: string; time: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null); // mobile tap flow
  const [dragMatchId, setDragMatchId] = useState<string | null>(null);
  // Punto 2 del cierre: mover fuera de la disponibilidad configurada nunca
  // es silencioso — se corta acá y se ofrecen las dos vías explícitas.
  const [outsidePoolPrompt, setOutsidePoolPrompt] = useState<{ matchId: string; courtId: string; date: string; time: string } | null>(null);

  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const s of poolSlots) set.add(s.date);
    for (const m of matches) if (m.scheduledDate) set.add(m.scheduledDate);
    return [...set].sort();
  }, [poolSlots, matches]);

  const [activeDate, setActiveDate] = useState<string | null>(allDates[0] ?? null);
  const date = activeDate ?? allDates[0] ?? null;

  const timesForDate = useMemo(() => {
    if (!date) return [];
    const set = new Set<string>();
    for (const s of poolSlots) if (s.date === date) set.add(s.time);
    for (const m of matches) if (m.scheduledDate === date && m.scheduledTime) set.add(m.scheduledTime.slice(0, 5));
    return [...set].sort();
  }, [date, poolSlots, matches]);

  const poolKeySet = useMemo(() => new Set(poolSlots.map((s) => `${s.date}|${s.courtId}|${s.time}`)), [poolSlots]);

  const matchByCell = useMemo(() => {
    const map = new Map<string, SchedulerMatch>();
    for (const m of matches) {
      if (m.courtId && m.scheduledDate && m.scheduledTime) {
        map.set(`${m.scheduledDate}|${m.courtId}|${m.scheduledTime.slice(0, 5)}`, m);
      }
    }
    return map;
  }, [matches]);

  const unscheduled = matches.filter((m) => !m.scheduledDate && m.pair1Id && m.pair2Id && m.status !== "finished");

  function pairConflict(match: SchedulerMatch, targetDate: string, targetTime: string): string | null {
    for (const other of matches) {
      if (other.id === match.id) continue;
      if (other.scheduledDate !== targetDate || !other.scheduledTime || other.scheduledTime.slice(0, 5) !== targetTime) continue;
      if (
        (match.pair1Id && (other.pair1Id === match.pair1Id || other.pair2Id === match.pair1Id)) ||
        (match.pair2Id && (other.pair1Id === match.pair2Id || other.pair2Id === match.pair2Id))
      ) {
        return `${other.pair1Id === match.pair1Id || other.pair1Id === match.pair2Id ? other.pair1Name : other.pair2Name} ya juega otro partido a esa hora.`;
      }
    }
    return null;
  }

  function feederConflict(match: SchedulerMatch, targetDate: string, targetTime: string): string | null {
    const feederIds = [match.feederLeftMatchId, match.feederRightMatchId].filter(Boolean) as string[];
    for (const fid of feederIds) {
      const feeder = matches.find((m) => m.id === fid);
      if (!feeder?.scheduledDate || !feeder.scheduledTime) continue;
      const feederKey = `${feeder.scheduledDate}${feeder.scheduledTime.slice(0, 5)}`;
      const targetKey = `${targetDate}${targetTime}`;
      if (feeder.status !== "finished" && targetKey <= feederKey) {
        return "Depende de un partido anterior del cuadro que todavía no se jugó a esa hora.";
      }
    }
    return null;
  }

  function executeMove(matchId: string, courtId: string, targetDate: string, targetTime: string) {
    start(async () => {
      const res = await assignTournamentMatchSlot({
        matchId,
        courtId,
        matchDate: targetDate,
        matchTime: targetTime,
        clubId,
        tournamentId,
      });
      if (!res.ok) {
        setError(res.error ?? "No se pudo mover el partido.");
        return;
      }
      setSelectedMatchId(null);
      setOutsidePoolPrompt(null);
      router.refresh();
    });
  }

  /**
   * Valida en el cliente lo que la UX necesita resolver antes de intentar
   * (pareja ocupada, feeder pendiente, partido finalizado) — la garantía
   * real sigue viviendo en el server (tournament_assign_match_slot valida
   * todo de nuevo, incluido el conflicto de pareja). Si la celda destino no
   * está en la disponibilidad configurada del torneo, NO se mueve
   * directamente: se corta y se ofrecen las dos vías explícitas (ampliar
   * disponibilidad, o asignación administrativa reconocida como tal).
   */
  function attemptMove(matchId: string, courtId: string, targetDate: string, targetTime: string) {
    setOutsidePoolPrompt(null);
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    if (match.status === "finished") {
      setError("No se puede reprogramar un partido ya finalizado.");
      return;
    }
    const pc = pairConflict(match, targetDate, targetTime);
    if (pc) {
      setError(pc);
      return;
    }
    const fc = feederConflict(match, targetDate, targetTime);
    if (fc) {
      setError(fc);
      return;
    }
    setError(null);

    const inPool = poolKeySet.has(`${targetDate}|${courtId}|${targetTime}`);
    if (!inPool) {
      setOutsidePoolPrompt({ matchId, courtId, date: targetDate, time: targetTime });
      return;
    }
    executeMove(matchId, courtId, targetDate, targetTime);
  }

  function expandAvailabilityAndMove() {
    if (!outsidePoolPrompt) return;
    const { matchId, courtId, date: d, time: t } = outsidePoolPrompt;
    start(async () => {
      const newSlots: TournamentSlot[] = [...poolSlots, { date: d, courtId, time: t }];
      const res = await updateTournamentAvailabilityAction(tournamentId, newSlots);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      executeMove(matchId, courtId, d, t);
    });
  }

  function MatchCard({ m, draggable }: { m: SchedulerMatch; draggable: boolean }) {
    const isSelected = selectedMatchId === m.id;
    const isOutsidePool =
      m.courtId && m.scheduledDate && m.scheduledTime && !poolKeySet.has(`${m.scheduledDate}|${m.courtId}|${m.scheduledTime.slice(0, 5)}`);
    return (
      <div
        draggable={draggable}
        onDragStart={() => setDragMatchId(m.id)}
        onDragEnd={() => setDragMatchId(null)}
        onClick={() => setSelectedMatchId((prev) => (prev === m.id ? null : m.id))}
        className={`cursor-pointer rounded-lg border p-1.5 text-[10px] leading-tight ${
          isSelected
            ? "border-[#0085FC] bg-[#0085FC]/10 ring-2 ring-[#0085FC]"
            : m.status === "finished"
              ? "border-[var(--border-subtle)] bg-[var(--bg-subtle)] opacity-70"
              : isOutsidePool
                ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20"
                : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
        }`}
      >
        <p className="font-semibold text-[var(--text-tertiary)]">{m.categoryLabel}</p>
        <p className="text-[var(--text-primary)]">{m.pair1Name}</p>
        <p className="text-[var(--text-tertiary)]">vs</p>
        <p className="text-[var(--text-primary)]">{m.pair2Name}</p>
        {m.status === "finished" ? <span className={`${adminBadgeLima} mt-1`}>Finalizado</span> : null}
        {m.status !== "finished" && isOutsidePool ? (
          <span className="mt-1 inline-block rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-200">
            Fuera de disponibilidad
          </span>
        ) : null}
      </div>
    );
  }

  if (allDates.length === 0) {
    return <p className="text-xs text-[var(--text-tertiary)]">Configurá disponibilidad del torneo para poder programar partidos.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-tertiary)]">
        Escritorio: arrastrá un partido a una celda. Celular: tocá un partido para seleccionarlo y después tocá la celda destino.
      </p>
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      {pending ? <p className="text-xs text-[var(--text-tertiary)]">Guardando movimiento…</p> : null}

      {outsidePoolPrompt ? (
        <div className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-3 text-xs dark:border-amber-700 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {outsidePoolPrompt.date} {outsidePoolPrompt.time}hs no está dentro de la disponibilidad configurada para este torneo.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={pending} className={`${adminCTAPrimary} px-2 py-1 text-xs disabled:opacity-50`} onClick={expandAvailabilityAndMove}>
              Ampliar disponibilidad y mover
            </button>
            <button
              type="button"
              disabled={pending}
              className={`${adminButtonSecondary} px-2 py-1 text-xs disabled:opacity-50`}
              onClick={() => executeMove(outsidePoolPrompt.matchId, outsidePoolPrompt.courtId, outsidePoolPrompt.date, outsidePoolPrompt.time)}
            >
              Asignar igual (fuera de disponibilidad)
            </button>
            <button type="button" className="px-2 py-1 text-xs font-semibold text-rose-500" onClick={() => setOutsidePoolPrompt(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {allDates.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setActiveDate(d)}
            className={`rounded-full border px-3 py-1 text-xs ${d === date ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}
          >
            {d}
          </button>
        ))}
      </div>

      {unscheduled.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">Sin programar ({unscheduled.length})</p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((m) => (
              <div key={m.id} className="w-32">
                <MatchCard m={m} draggable />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {date && timesForDate.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-14 py-1 text-left font-mono text-[var(--text-tertiary)]">Hora</th>
                {courts.map((c) => (
                  <th key={c.id} className="min-w-[120px] px-1 py-1 text-center font-semibold text-[var(--text-secondary)]">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timesForDate.map((time) => (
                <tr key={time} className="border-t border-[var(--border-subtle)]">
                  <td className="py-1 pr-2 font-mono text-[var(--text-tertiary)]">{time}</td>
                  {courts.map((court) => {
                    const key = `${date}|${court.id}|${time}`;
                    const cellMatch = matchByCell.get(key);
                    const inPool = poolKeySet.has(key);
                    return (
                      <td
                        key={court.id}
                        className="px-1 py-1 align-top"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragMatchId) attemptMove(dragMatchId, court.id, date, time);
                          setDragMatchId(null);
                        }}
                        onClick={() => {
                          if (selectedMatchId && !cellMatch) attemptMove(selectedMatchId, court.id, date, time);
                        }}
                      >
                        {cellMatch ? (
                          <MatchCard m={cellMatch} draggable />
                        ) : (
                          <div
                            className={`flex h-14 items-center justify-center rounded-lg border border-dashed text-[10px] ${
                              inPool
                                ? "border-[#0085FC]/30 text-[var(--text-tertiary)]"
                                : "border-[var(--border-subtle)] text-[var(--text-tertiary)] opacity-50"
                            } ${selectedMatchId ? "cursor-pointer hover:bg-[#0085FC]/5" : ""}`}
                          >
                            {inPool ? "Libre" : "—"}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)]">No hay franjas configuradas para este día.</p>
      )}

      {selectedMatchId ? (
        <button type="button" onClick={() => setSelectedMatchId(null)} className={`${adminButtonSecondary} text-xs`}>
          Cancelar selección
        </button>
      ) : null}
    </div>
  );
}
