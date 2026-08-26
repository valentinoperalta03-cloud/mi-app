"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";
import { beginTournamentCheckoutAction, registerTournamentOfflineAction } from "./actions";
import { nativeOpenUrl } from "@/lib/native-open";

type Props = {
  tournamentId: string;
  isIndividual: boolean;
  canRegister: boolean;
  acceptsMp: boolean;
  acceptsCash: boolean;
  acceptsTransfer: boolean;
  transferAlias: string | null;
};

export default function TournamentRegisterForm({
  tournamentId,
  isIndividual,
  canRegister,
  acceptsMp,
  acceptsCash,
  acceptsTransfer,
  transferAlias,
}: Props) {
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [results, setResults] = useState<Array<{ user_id: string; name: string | null }>>([]);
  const [paymentMethod, setPaymentMethod] = useState<"mp" | "cash" | "transfer">(
    acceptsMp ? "mp" : acceptsCash ? "cash" : "transfer"
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

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
    fd.set("partner_user_id", isIndividual ? "" : partnerId);
    start(async () => {
      if (paymentMethod === "mp") {
        const res = await beginTournamentCheckoutAction(fd);
        if (!res.ok) {
          setMsg(res.message);
          return;
        }
        if (res.url) await nativeOpenUrl(res.url);
        return;
      }
      fd.set("payment_method", paymentMethod);
      const res = await registerTournamentOfflineAction(fd);
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      setRegistered(true);
    });
  }

  if (!canRegister) return null;

  if (registered) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
        ¡Inscripción registrada! Pagá en el club{" "}
        {paymentMethod === "transfer" && transferAlias ? `(alias: ${transferAlias}) ` : ""}
        para confirmar tu lugar.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Inscribirse</h3>
      {msg ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{msg}</p> : null}
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        {!isIndividual ? (
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
          <p className="text-xs text-[var(--text-tertiary)]">Inscripción individual. Te asignamos pareja por sorteo el día de la peña.</p>
        )}

        {acceptsCash || acceptsTransfer ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">¿Cómo vas a pagar?</label>
            <div className="flex flex-col gap-2">
              {acceptsMp ? (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment_method"
                    value="mp"
                    checked={paymentMethod === "mp"}
                    onChange={() => setPaymentMethod("mp")}
                  />
                  <span className="text-sm">💳 Mercado Pago</span>
                </label>
              ) : null}
              {acceptsCash ? (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment_method"
                    value="cash"
                    checked={paymentMethod === "cash"}
                    onChange={() => setPaymentMethod("cash")}
                  />
                  <span className="text-sm">💵 Efectivo en el club</span>
                </label>
              ) : null}
              {acceptsTransfer ? (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment_method"
                    value="transfer"
                    checked={paymentMethod === "transfer"}
                    onChange={() => setPaymentMethod("transfer")}
                  />
                  <span className="text-sm">
                    🏦 Transferencia
                    {transferAlias ? ` — ${transferAlias}` : ""}
                  </span>
                </label>
              ) : null}
            </div>
          </div>
        ) : null}

        {paymentMethod === "mp" ? (
          <p className="text-[11px] text-[var(--text-tertiary)]">
            El pago se procesa con Mercado Pago. El 100% va directo a la cuenta del club, sin comisión de PadeLibre.
          </p>
        ) : (
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Tu lugar queda pendiente hasta que pagues en el club.
          </p>
        )}
        <button
          type="submit"
          disabled={pending || (!isIndividual && !partnerId)}
          className="btn-primary-gradient w-full rounded-2xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Procesando…" : paymentMethod === "mp" ? "Pagar inscripción" : "Confirmar inscripción"}
        </button>
      </form>
    </div>
  );
}
