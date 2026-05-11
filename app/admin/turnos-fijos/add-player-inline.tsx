"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";
import { addPlayerToFixedSlot } from "./actions";

type PlayerResult = { user_id: string; name: string | null };

export default function AddPlayerInline({ fixedSlotId }: { fixedSlotId: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlayerResult[]>([]);

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
      .limit(6);
    setResults((data ?? []) as PlayerResult[]);
    setLoading(false);
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Agregar jugador al turno</p>
      <input
        value={query}
        onChange={(e) => void searchPlayers(e.target.value)}
        placeholder="Buscar por nombre"
        className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      {loading ? <p className="mt-2 text-[11px] text-slate-500">Buscando...</p> : null}
      {results.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {results.map((r) => (
            <li key={r.user_id} className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-700 dark:text-slate-200">{r.name ?? "Jugador"}</span>
              <form action={addPlayerToFixedSlot}>
                <input type="hidden" name="fixed_slot_id" value={fixedSlotId} />
                <input type="hidden" name="player_id" value={r.user_id} />
                <button
                  type="submit"
                  className="rounded-lg border border-[#0585FC]/30 bg-[#0585FC]/10 px-2 py-1 text-[11px] font-semibold text-[#0461C4] dark:text-sky-300"
                >
                  Agregar
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
