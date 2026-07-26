"use client";

import { useState } from "react";
import { adminCard, adminCTAPrimary } from "@/components/admin/admin-premium";
import { updatePenaRoundMatchAction } from "../actions";

type Player = { id: string; name: string };
type Court = { id: string; name: string };

type MatchRow = {
  id: string;
  match_order: number;
  pair1_player1_id: string | null;
  pair1_player2_id: string | null;
  pair2_player1_id: string | null;
  pair2_player2_id: string | null;
  court_id: string | null;
};

type Props = {
  matches: MatchRow[];
  players: Player[];
  courts: Court[];
};

const selectClass =
  "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]";

export function PenaRoundMatches({ matches, players, courts }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const nameOf = (id: string | null) => (id ? players.find((p) => p.id === id)?.name ?? "Jugador" : "—");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, matchId: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      pair1_player1_id: String(fd.get("pair1_player1_id") ?? "") || null,
      pair1_player2_id: String(fd.get("pair1_player2_id") ?? "") || null,
      pair2_player1_id: String(fd.get("pair2_player1_id") ?? "") || null,
      pair2_player2_id: String(fd.get("pair2_player2_id") ?? "") || null,
      court_id: String(fd.get("court_id") ?? "") || null,
    };

    setSaving(matchId);
    setErrors((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    const res = await updatePenaRoundMatchAction(matchId, data);
    setSaving(null);
    if (res.ok) {
      setSaved((prev) => ({ ...prev, [matchId]: true }));
    } else {
      setErrors((prev) => ({ ...prev, [matchId]: res.error ?? "No se pudo guardar." }));
    }
  }

  function playerSelect(name: string, defaultValue: string | null) {
    return (
      <select name={name} defaultValue={defaultValue ?? ""} className={selectClass}>
        <option value="">— Sin asignar —</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <ul className="mt-3 space-y-3">
      {matches.map((m) => (
        <li key={m.id} className={adminCard}>
          <p className="text-xs font-semibold text-[var(--text-tertiary)]">Partido {m.match_order}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {nameOf(m.pair1_player1_id)} / {nameOf(m.pair1_player2_id)} vs {nameOf(m.pair2_player1_id)} /{" "}
            {nameOf(m.pair2_player2_id)}
          </p>
          <form onSubmit={(e) => handleSubmit(e, m.id)} className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Pareja 1</p>
              {playerSelect("pair1_player1_id", m.pair1_player1_id)}
              {playerSelect("pair1_player2_id", m.pair1_player2_id)}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Pareja 2</p>
              {playerSelect("pair2_player1_id", m.pair2_player1_id)}
              {playerSelect("pair2_player2_id", m.pair2_player2_id)}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Cancha</p>
              <select name="court_id" defaultValue={m.court_id ?? ""} className={selectClass}>
                <option value="">Sin cancha</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={saving === m.id} className={`w-full ${adminCTAPrimary} px-2 py-1 text-xs disabled:opacity-50`}>
                {saving === m.id ? "Guardando…" : "Editar"}
              </button>
            </div>
          </form>
          {errors[m.id] ? <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">{errors[m.id]}</p> : null}
          {saved[m.id] && !errors[m.id] ? <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">Guardado</p> : null}
        </li>
      ))}
    </ul>
  );
}
