"use client";

import { useState } from "react";
import { adminCard, adminCTAPrimary } from "@/components/admin/admin-premium";
import { saveMatchScheduleAction } from "./actions";

type Court = { id: string; name: string };

type MatchRow = {
  id: string;
  round_name: string | null;
  pair1_name: string;
  pair2_name: string;
  court_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
};

type Props = {
  tournamentId: string;
  matches: MatchRow[];
  courts: Court[];
};

type Schedule = { court_id: string; scheduled_date: string; scheduled_time: string };

function detectConflict(
  matchId: string,
  next: Schedule,
  schedules: Record<string, Schedule>
): string | null {
  if (!next.court_id || !next.scheduled_date || !next.scheduled_time) return null;
  for (const [id, s] of Object.entries(schedules)) {
    if (id === matchId) continue;
    if (s.court_id === next.court_id && s.scheduled_date === next.scheduled_date && s.scheduled_time === next.scheduled_time) {
      return `Conflicto: otra partido ya tiene asignada esta cancha en ese horario.`;
    }
  }
  return null;
}

export function TournamentScheduler({ tournamentId, matches, courts }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Rastrear horarios guardados para detectar conflictos entre partidos
  const [schedules, setSchedules] = useState<Record<string, Schedule>>(() => {
    const init: Record<string, Schedule> = {};
    for (const m of matches) {
      if (m.court_id || m.scheduled_date || m.scheduled_time) {
        init[m.id] = {
          court_id: m.court_id ?? "",
          scheduled_date: m.scheduled_date ?? "",
          scheduled_time: m.scheduled_time ?? "",
        };
      }
    }
    return init;
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, matchId: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next: Schedule = {
      court_id: String(fd.get("court_id") ?? ""),
      scheduled_date: String(fd.get("scheduled_date") ?? ""),
      scheduled_time: String(fd.get("scheduled_time") ?? ""),
    };

    const conflict = detectConflict(matchId, next, schedules);
    if (conflict) {
      setErrors((prev) => ({ ...prev, [matchId]: conflict }));
      return;
    }
    setErrors((prev) => { const c = { ...prev }; delete c[matchId]; return c; });

    setSaving(matchId);
    const res = await saveMatchScheduleAction(fd);
    setSaving(null);
    if (res.ok) {
      setSchedules((prev) => ({ ...prev, [matchId]: next }));
    } else {
      setErrors((prev) => ({ ...prev, [matchId]: res.message }));
    }
  }

  const playableMatches = matches.filter((m) => m.pair1_name !== "—" && m.pair2_name !== "—");

  if (playableMatches.length === 0) {
    return (
      <section>
        <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">Canchas y horarios</h2>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">No hay partidos con parejas asignadas aun.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">Canchas y horarios</h2>
      <ul className="mt-3 space-y-3">
        {playableMatches.map((m) => {
          const saved = Boolean(schedules[m.id]);
          return (
            <li
              key={m.id}
              className={adminCard}
            >
              <p className="text-xs font-semibold text-[var(--text-tertiary)]">{m.round_name ?? "Partido"}</p>
              <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">
                {m.pair1_name} vs {m.pair2_name}
              </p>
              <form onSubmit={(e) => handleSubmit(e, m.id)} className="mt-2 grid gap-2 sm:grid-cols-4">
                <input type="hidden" name="tournament_id" value={tournamentId} />
                <input type="hidden" name="match_id" value={m.id} />

                <select
                  name="court_id"
                  defaultValue={m.court_id ?? ""}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[var(--text-primary)]"
                >
                  <option value="">Sin cancha</option>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <input
                  type="date"
                  name="scheduled_date"
                  defaultValue={m.scheduled_date ?? ""}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[var(--text-primary)]"
                />

                <input
                  type="time"
                  name="scheduled_time"
                  defaultValue={m.scheduled_time ?? ""}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[var(--text-primary)]"
                />

                <button
                  type="submit"
                  disabled={saving === m.id}
                  className={`${adminCTAPrimary} disabled:opacity-50`}
                >
                  {saving === m.id ? "..." : saved ? "Guardado" : "Guardar"}
                </button>
              </form>

              {errors[m.id] ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">{errors[m.id]}</p>
              ) : null}

              {saved && !errors[m.id] ? (
                <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">Horario guardado</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
