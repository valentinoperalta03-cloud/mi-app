"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { adminInputClass, adminLabelClass } from "@/components/admin/admin-form-input";
import {
  adminBadgeBrand,
  adminBadgeNeutral,
  adminBadgePending,
  adminCTAPrimary,
  adminButtonGhost,
  adminCard,
  adminEmptyState,
} from "@/components/admin/admin-premium";
import {
  confirmOfflineCobro,
  confirmPracticeOfflineCobro,
  confirmTournamentOfflineCobro,
  markOfflineNoShow,
  markPracticeOfflineNoShow,
  registrarPagoParcial,
} from "./actions";

export type PendingMatchItem = {
  kind: "match";
  id: string;
  badge: "Reserva" | "Partido abierto" | "Turno fijo";
  courtLabel: string;
  time: string;
  playerName: string;
  totalPrice: number;
  amountPaid: number;
  amountPending: number;
};

export type PendingPracticeItem = {
  kind: "practice";
  id: string;
  title: string;
  time: string;
  playerName: string;
  amount: number;
};

export type PendingTournamentItem = {
  kind: "tournament";
  id: string;
  tournamentName: string;
  playerName: string;
  amount: number;
};

export type PendingItem = PendingMatchItem | PendingPracticeItem | PendingTournamentItem;

export type ConfirmedItem = {
  kind: "match" | "practice";
  id: string;
  label: string;
  time: string;
  playerName: string;
  amount: number;
  method: "cash" | "transfer" | null;
};

const btnSuccess =
  "w-full rounded-2xl border border-emerald-300 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 " +
  "transition hover:bg-emerald-100 active:scale-[0.99] dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300";

const btnNeutral =
  "w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-3 text-sm font-semibold " +
  "text-[var(--text-secondary)] transition hover:bg-[var(--bg-app)] active:scale-[0.99]";

function fmt(n: number) {
  return n.toLocaleString("es-AR");
}

export default function CobrosClient({
  pendingItems,
  confirmedItems,
}: {
  pendingItems: PendingItem[];
  confirmedItems: ConfirmedItem[];
  todayLabel: string;
}) {
  const [modalItem, setModalItem] = useState<PendingMatchItem | null>(null);

  return (
    <>
      <section className="space-y-3">
        <h2 className="font-admin-display text-sm font-bold text-[var(--text-primary)]">Pendientes hoy</h2>
        {pendingItems.length === 0 ? (
          <p className={adminEmptyState}>No hay cobros pendientes para hoy.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingItems.map((item) => (
              <PendingCard
                key={`${item.kind}-${item.id}`}
                item={item}
                onRegistrarPago={() => setModalItem(item.kind === "match" ? item : null)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-admin-display text-sm font-bold text-[var(--text-primary)]">Confirmados hoy</h2>
        {confirmedItems.length === 0 ? (
          <p className={adminEmptyState}>Todavía no confirmaste cobros hoy.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {confirmedItems.map((item) => (
              <ConfirmedCard key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </section>

      {modalItem ? <RegistrarPagoModal item={modalItem} onClose={() => setModalItem(null)} /> : null}
    </>
  );
}

function PendingCard({ item, onRegistrarPago }: { item: PendingItem; onRegistrarPago: () => void }) {
  if (item.kind === "match") {
    return (
      <li className={`${adminCard} flex flex-col gap-3`}>
        <div>
          <span className={adminBadgeBrand}>{item.badge}</span>
          <p className="mt-1.5 text-base font-bold text-[var(--text-primary)]">
            {item.courtLabel} · {item.time}hs
          </p>
          <p className="text-sm text-[var(--text-tertiary)]">Jugador: {item.playerName}</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Total: <span className="font-semibold text-[var(--text-primary)]">${fmt(item.totalPrice)}</span>
          {" · "}
          Abonado: <span className="font-semibold text-[var(--text-primary)]">${fmt(item.amountPaid)}</span>
          {" · "}
          Restante:{" "}
          <span className="font-semibold text-amber-700 dark:text-amber-300">${fmt(item.amountPending)}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onRegistrarPago} className={`flex-1 ${adminCTAPrimary}`}>
            $ Registrar pago
          </button>
          <form action={confirmOfflineCobro} className="flex-1">
            <input type="hidden" name="match_id" value={item.id} />
            <button type="submit" className={btnSuccess}>
              Pagaron todo ✓
            </button>
          </form>
          <form action={markOfflineNoShow} className="flex-1">
            <input type="hidden" name="match_id" value={item.id} />
            <button type="submit" className={btnNeutral}>
              No se presentó
            </button>
          </form>
        </div>
      </li>
    );
  }

  if (item.kind === "practice") {
    return (
      <li className={`${adminCard} flex flex-col gap-3`}>
        <div>
          <span className={adminBadgeNeutral}>Clase</span>
          <p className="mt-1.5 text-base font-bold text-[var(--text-primary)]">
            {item.title} · {item.time}hs
          </p>
          <p className="text-sm text-[var(--text-tertiary)]">Jugador: {item.playerName}</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Monto: <span className="font-semibold text-[var(--text-primary)]">${fmt(item.amount)}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={confirmPracticeOfflineCobro} className="flex-1">
            <input type="hidden" name="registration_id" value={item.id} />
            <button type="submit" className={btnSuccess}>
              Pagaron todo ✓
            </button>
          </form>
          <form action={markPracticeOfflineNoShow} className="flex-1">
            <input type="hidden" name="registration_id" value={item.id} />
            <button type="submit" className={btnNeutral}>
              No se presentó
            </button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li className={`${adminCard} flex flex-col gap-3`}>
      <div>
        <span className={adminBadgePending}>Torneo</span>
        <p className="mt-1.5 text-base font-bold text-[var(--text-primary)]">{item.tournamentName}</p>
        <p className="text-sm text-[var(--text-tertiary)]">Jugador: {item.playerName}</p>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        Monto: <span className="font-semibold text-[var(--text-primary)]">${fmt(item.amount)}</span>
      </p>
      <form action={confirmTournamentOfflineCobro}>
        <input type="hidden" name="registration_id" value={item.id} />
        <button type="submit" className={btnSuccess}>
          Pagaron todo ✓
        </button>
      </form>
    </li>
  );
}

function ConfirmedCard({ item }: { item: ConfirmedItem }) {
  const methodLabel = item.method === "cash" ? "Efectivo" : item.method === "transfer" ? "Transferencia" : "—";
  return (
    <li
      className={`${adminCard} flex flex-wrap items-center justify-between gap-2 border-emerald-200/60 dark:border-emerald-900/40`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--text-primary)]">{item.playerName}</p>
        <p className="text-sm text-[var(--text-tertiary)]">
          {item.label} · {item.time || "—"}
        </p>
        <span className={`mt-1.5 inline-block ${adminBadgeNeutral}`}>{methodLabel}</span>
      </div>
      <p className="shrink-0 text-lg font-bold text-emerald-700 dark:text-emerald-300">${fmt(item.amount)}</p>
    </li>
  );
}

function RegistrarPagoModal({ item, onClose }: { item: PendingMatchItem; onClose: () => void }) {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<"cash" | "transfer">("cash");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleConfirm() {
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await registrarPagoParcial({ matchId: item.id, monto: montoNum, metodo });
      if (!result.ok) {
        setError(result.error ?? "No se pudo registrar el pago.");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const methodBtn = "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors";
  const methodBtnActive = `${methodBtn} border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]`;
  const methodBtnInactive = `${methodBtn} border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.3)] dark:bg-[var(--bg-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-admin-display text-base font-bold text-[var(--text-primary)]">
          {item.courtLabel} · {item.time}hs
        </h3>
        <div className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
          <p>
            Total: <span className="font-semibold text-[var(--text-primary)]">${fmt(item.totalPrice)}</span>
          </p>
          <p>
            Abonado: <span className="font-semibold text-[var(--text-primary)]">${fmt(item.amountPaid)}</span>
          </p>
          <p>
            Restante:{" "}
            <span className="font-semibold text-amber-700 dark:text-amber-300">${fmt(item.amountPending)}</span>
          </p>
        </div>

        <label className="mt-4 block">
          <span className={adminLabelClass}>¿Cuánto abonaron?</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value);
              setError(null);
            }}
            className={adminInputClass}
            placeholder="0"
          />
        </label>

        <div className="mt-4">
          <span className={adminLabelClass}>Método</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMetodo("cash")}
              className={metodo === "cash" ? methodBtnActive : methodBtnInactive}
            >
              Efectivo
            </button>
            <button
              type="button"
              onClick={() => setMetodo("transfer")}
              className={metodo === "transfer" ? methodBtnActive : methodBtnInactive}
            >
              Transferencia
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className={`flex-1 ${adminButtonGhost}`}>
            Cancelar
          </button>
          <button type="button" disabled={pending} onClick={handleConfirm} className={`flex-1 ${adminCTAPrimary}`}>
            {pending ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
