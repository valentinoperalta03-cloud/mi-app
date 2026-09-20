"use client";

import { useState, useTransition } from "react";
import {
  acceptPartnerRequestAction,
  createPartnerRequestAction,
  withdrawPartnerRequestAction,
} from "../partner-search-actions";

export type PartnerRequestRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  playerId: string;
  playerName: string;
  playerLevel: number | null;
  position: "drive" | "reves" | "indistinto";
};

const POSITION_LABEL: Record<string, string> = { drive: "Drive", reves: "Revés", indistinto: "Indistinto" };

/**
 * Sección 14: jugadores que buscan pareja para el torneo. No confundir con
 * lista de espera por cupo completo (tournament_partner_requests no ocupa
 * cupo — ver comentario en la migración V2-A).
 */
export function PartnerSearchPanel({
  tournamentId,
  categories,
  requests,
  myUserId,
  mySeekingRequestId,
  acceptsMp,
  acceptsCash,
  acceptsTransfer,
}: {
  tournamentId: string;
  categories: Array<{ id: string; name: string }>;
  requests: PartnerRequestRow[];
  myUserId: string;
  mySeekingRequestId: string | null;
  acceptsMp: boolean;
  acceptsCash: boolean;
  acceptsTransfer: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [position, setPosition] = useState<"drive" | "reves" | "indistinto">("indistinto");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"mp" | "cash" | "transfer">(acceptsMp ? "mp" : acceptsCash ? "cash" : "transfer");

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">🔎 Busco pareja</h2>
        {!mySeekingRequestId ? (
          <button type="button" onClick={() => setShowForm((v) => !v)} className="text-xs font-semibold text-[#0461C4]">
            {showForm ? "Cancelar" : "+ Buscar compañero/a"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await withdrawPartnerRequestAction(tournamentId, mySeekingRequestId);
                setMsg(res.message);
              });
            }}
            className="text-xs font-semibold text-rose-500"
          >
            Retirar mi búsqueda
          </button>
        )}
      </div>

      {msg ? <p className="mt-2 text-xs text-[var(--text-secondary)]">{msg}</p> : null}

      {showForm && !mySeekingRequestId ? (
        <div className="mt-3 space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          {categories.length > 1 ? (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex gap-2">
            {(["drive", "reves", "indistinto"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPosition(p)}
                className={`rounded-full border px-3 py-1 text-xs ${position === p ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0461C4]" : "border-[var(--border-subtle)]"}`}
              >
                {POSITION_LABEL[p]}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={pending || !categoryId}
            className="btn-primary-gradient w-full rounded-2xl py-2.5 text-sm font-semibold disabled:opacity-50"
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await createPartnerRequestAction(tournamentId, categoryId, position);
                setMsg(res.message);
                if (res.ok) setShowForm(false);
              });
            }}
          >
            {pending ? "Publicando…" : "Publicar búsqueda"}
          </button>
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {requests
          .filter((r) => r.playerId !== myUserId)
          .map((r) => (
            <li key={r.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-sm">
              <p className="font-medium text-[var(--text-primary)]">{r.playerName}</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {r.categoryName} · {POSITION_LABEL[r.position]}
                {r.playerLevel ? ` · Nivel ${r.playerLevel}` : ""}
              </p>
              {acceptingId === r.id ? (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {acceptsMp ? (
                      <button type="button" onClick={() => setPayMethod("mp")} className={`rounded-full border px-2 py-1 text-[11px] ${payMethod === "mp" ? "border-[#0085FC] text-[#0461C4]" : "border-[var(--border-subtle)]"}`}>
                        Mercado Pago
                      </button>
                    ) : null}
                    {acceptsCash ? (
                      <button type="button" onClick={() => setPayMethod("cash")} className={`rounded-full border px-2 py-1 text-[11px] ${payMethod === "cash" ? "border-[#0085FC] text-[#0461C4]" : "border-[var(--border-subtle)]"}`}>
                        Efectivo
                      </button>
                    ) : null}
                    {acceptsTransfer ? (
                      <button type="button" onClick={() => setPayMethod("transfer")} className={`rounded-full border px-2 py-1 text-[11px] ${payMethod === "transfer" ? "border-[#0085FC] text-[#0461C4]" : "border-[var(--border-subtle)]"}`}>
                        Transferencia
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    className="btn-primary-gradient w-full rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
                    onClick={() => {
                      setMsg(null);
                      start(async () => {
                        const res = await acceptPartnerRequestAction(tournamentId, r.id, payMethod);
                        setMsg(res.message);
                        if (res.ok) {
                          setAcceptingId(null);
                          if (res.url) window.location.href = res.url;
                        }
                      });
                    }}
                  >
                    {pending ? "Procesando…" : "Confirmar y formar pareja"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setAcceptingId(r.id)} className="mt-2 text-xs font-semibold text-[#0461C4]">
                  Ser su compañero/a →
                </button>
              )}
            </li>
          ))}
        {requests.filter((r) => r.playerId !== myUserId).length === 0 ? (
          <li className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
            Nadie está buscando compañero/a todavía.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
