"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";
import { beginTournamentCheckoutAction } from "./actions";
import { nativeOpenUrl } from "@/lib/native-open";

type Props = {
  tournamentId: string;
  isMixing: boolean;
  canRegister: boolean;
};

export default function TournamentRegisterForm({ tournamentId, isMixing, canRegister }: Props) {
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [results, setResults] = useState<Array<{ user_id: string; name: string | null }>>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function searchPlayers(q: string) {
    setPartnerQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.from(DB_TABLES.profiles).select("user_id,name").ilike("name", `%${q.trim()}%`).limit(6);
    setResults((data ?? []) as Array<{ user_id: string; name: string | null }>);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("tournament_id", tournamentId);
    fd.set("partner_user_id", isMixing ? "" : partnerId);
    start(async () => {
      const res = await beginTournamentCheckoutAction(fd);
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      if (res.url) await nativeOpenUrl(res.url);
    });
  }

  if (!canRegister) return null;

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Inscribirse</h3>
      {msg ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{msg}</p> : null}
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        {!isMixing ? (
          <div>
            <label className="text-xs font-medium text-[var(--text-tertiary)]">Compañero/a</label>
            <input
              value={partnerQuery}
              onChange={(e) => void searchPlayers(e.target.value)}
              placeholder="Buscar por nombre"
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
            />
            {results.length > 0 ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-2">
                {results.map((r) => (
                  <li key={r.user_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerId(r.user_id);
                        setPartnerQuery(r.name ?? "Jugador");
                        setResults([]);
                      }}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-subtle)]"
                    >
                      {r.name ?? "Jugador"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input type="hidden" name="partner_user_id" value={partnerId} />
          </div>
        ) : (
          <p className="text-xs text-[var(--text-tertiary)]">Mixing: inscripción individual. Te asignamos pareja por sorteo.</p>
        )}
        <p className="text-[11px] text-[var(--text-tertiary)]">
          El pago se procesa con Mercado Pago. El 100% va directo a la cuenta del club, sin comisión de PadeLibre.
        </p>
        <button
          type="submit"
          disabled={pending || (!isMixing && !partnerId)}
          className="btn-primary-gradient w-full rounded-2xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Procesando…" : "Pagar inscripción"}
        </button>
      </form>
    </div>
  );
}
