"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { createFixedSlot } from "./actions";

type Court = { id: string; name: string | null };
type PlayerResult = { user_id: string; name: string | null };
type SelectedPlayer = { playerId: string; name: string };

const SLOT_OPTIONS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00", "22:30"];
const DAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
];

export default function TurnosFijosForm({ courts }: { courts: Court[] }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [selected, setSelected] = useState<SelectedPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const playersPayload = useMemo(() => JSON.stringify(selected.map((p) => ({ playerId: p.playerId }))), [selected]);

  async function searchPlayers(next: string) {
    setQuery(next);
    if (next.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from(DB_TABLES.profiles)
      .select("user_id,name")
      .ilike("name", `%${next.trim()}%`)
      .limit(4);
    setResults((data ?? []) as PlayerResult[]);
    setLoading(false);
  }

  function addPlayer(player: PlayerResult) {
    if (selected.some((p) => p.playerId === player.user_id) || selected.length >= 4) return;
    setSelected((prev) => [
      ...prev,
      { playerId: player.user_id, name: player.name?.trim() || "Jugador" },
    ]);
    setQuery("");
    setResults([]);
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        const res = await createFixedSlot(formData);
        if (res?.error) setError(res.error);
      }}
      className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[var(--text-secondary)]">
          Cancha
          <select name="court_id" required className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
            <option value="">Seleccionar</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name ?? "Cancha"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-[var(--text-secondary)]">
          Dia
          <select name="day_of_week" required className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
            {DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[var(--text-secondary)]">
          Horario
          <select name="start_time" required className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
            {SLOT_OPTIONS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-[var(--text-secondary)]">
          Duracion
          <input
            name="duration_minutes"
            defaultValue="90"
            required
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-[var(--text-secondary)]">Buscar jugadores</label>
        <input
          value={query}
          onChange={(e) => void searchPlayers(e.target.value)}
          placeholder="Nombre del jugador"
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        {loading ? <p className="text-xs text-[var(--text-tertiary)]">Buscando...</p> : null}
        {results.length > 0 ? (
          <ul className="space-y-1 rounded-xl border border-[var(--border-subtle)] p-2">
            {results.map((r) => (
              <li key={r.user_id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-[var(--text-secondary)]">{r.name ?? "Jugador"}</span>
                <button
                  type="button"
                  onClick={() => addPlayer(r)}
                  className="rounded-lg border border-[#0085FC]/30 bg-[#0085FC]/10 px-2 py-1 text-xs font-semibold text-[#0461C4]"
                >
                  Agregar
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <ul className="space-y-2">
          {selected.map((p) => (
            <li key={p.playerId} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2">
              <span className="flex-1 text-sm font-medium text-[var(--text-secondary)]">{p.name}</span>
              <button
                type="button"
                onClick={() => setSelected((prev) => prev.filter((x) => x.playerId !== p.playerId))}
                className="rounded-lg border border-rose-300 bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)]">Seleccioná hasta 4 jugadores.</p>
      )}

      <input type="hidden" name="players_payload" value={playersPayload} />

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p> : null}

      <button type="submit" className={`w-full ${adminCTAPrimary}`}>
        Crear turno fijo
      </button>
    </form>
  );
}
