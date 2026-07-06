"use client";

import { useRef, useState } from "react";
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

export function TournamentScheduler({ tournamentId, matches, courts }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, matchId: string) {
    e.preventDefault();
    setSaving(matchId);
    const fd = new FormData(e.currentTarget);
    const res = await saveMatchScheduleAction(fd);
    setSaving(null);
    if (res.ok) setSaved((s) => new Set([...s, matchId]));
  }

  const playableMatches = matches.filter((m) => m.pair1_name !== "—" && m.pair2_name !== "—");

  if (playableMatches.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Canchas y horarios</h2>
        <p className="mt-2 text-sm text-slate-500">No hay partidos con parejas asignadas aun.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Canchas y horarios</h2>
      <ul className="mt-3 space-y-3">
        {playableMatches.map((m) => (
          <li
            key={m.id}
            className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
          >
            <p className="text-xs font-semibold text-slate-500">{m.round_name ?? "Partido"}</p>
            <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              {m.pair1_name} vs {m.pair2_name}
            </p>
            <form
              onSubmit={(e) => handleSubmit(e, m.id)}
              className="mt-2 grid gap-2 sm:grid-cols-4"
            >
              <input type="hidden" name="tournament_id" value={tournamentId} />
              <input type="hidden" name="match_id" value={m.id} />

              <select
                name="court_id"
                defaultValue={m.court_id ?? ""}
                className="rounded-lg border px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
                className="rounded-lg border px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />

              <input
                type="time"
                name="scheduled_time"
                defaultValue={m.scheduled_time ?? ""}
                className="rounded-lg border px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />

              <button
                type="submit"
                disabled={saving === m.id}
                className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700"
              >
                {saving === m.id ? "..." : saved.has(m.id) ? "Guardado" : "Guardar"}
              </button>
            </form>

            {(m.court_id || m.scheduled_date || m.scheduled_time) && (
              <p className="mt-1 text-[11px] text-slate-400">
                {m.scheduled_date ?? ""} {m.scheduled_time ? m.scheduled_time.slice(0, 5) : ""}{" "}
                {courts.find((c) => c.id === m.court_id)?.name ?? ""}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
