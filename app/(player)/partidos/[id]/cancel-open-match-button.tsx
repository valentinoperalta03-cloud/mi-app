"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cancelOpenMatch } from "./actions";

type Props = {
  matchId: string;
  /** Resuelto en el server: el partido está confirmado y la cancelación cae dentro de la ventana del club. */
  isLate: boolean;
  cancellationHours: number;
  totalPrice: number;
  amountPaid: number;
};

function fmt(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export default function CancelOpenMatchButton({
  matchId,
  isLate,
  cancellationHours,
  totalPrice,
  amountPaid,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pending = Math.max(totalPrice - amountPaid, 0);

  function handleConfirm() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("match_id", matchId);
        await cancelOpenMatch(fd);
      } catch (err) {
        if (isRedirectError(err)) throw err;
        console.error("[CancelOpenMatchButton]", err);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-rose-300 bg-rose-50 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-300"
      >
        Cancelar partido
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-t-3xl border-t border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-[18px] font-bold text-[var(--text-primary)]">¿Cancelar el partido?</h2>

                {isLate ? (
                  <div className="mt-3 rounded-2xl border border-rose-300/70 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/25">
                    <p className="text-sm leading-relaxed text-rose-900/90 dark:text-rose-100/85">
                      {cancellationHours <= 0
                        ? "Este partido ya estaba confirmado y el club no admite cancelaciones sin cargo."
                        : `Este partido ya estaba confirmado y faltan menos de ${cancellationHours} ${
                            cancellationHours === 1 ? "hora" : "horas"
                          }.`}{" "}
                      Si lo cancelás, quedará pendiente abonar el valor total de la cancha.
                    </p>
                    {totalPrice > 0 ? (
                      <dl className="mt-3 flex flex-col gap-1 text-sm text-rose-900/90 dark:text-rose-100/85">
                        <div className="flex justify-between">
                          <dt>Total cancha</dt>
                          <dd className="font-semibold">{fmt(totalPrice)}</dd>
                        </div>
                        {amountPaid > 0 ? (
                          <div className="flex justify-between">
                            <dt>Ya abonado</dt>
                            <dd className="font-semibold">-{fmt(amountPaid)}</dd>
                          </div>
                        ) : null}
                        <div className="flex justify-between border-t border-rose-300/50 pt-1 dark:border-rose-900/50">
                          <dt className="font-semibold">Quedará pendiente</dt>
                          <dd className="font-bold">{fmt(pending)}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Podés cancelar este partido sin cargo. La cancha queda liberada y se avisa a los jugadores
                    anotados.
                  </p>
                )}

                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleConfirm}
                    className="w-full rounded-2xl border border-rose-300 bg-rose-600 py-3.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {isPending ? "Cancelando..." : "Sí, cancelar el partido"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setOpen(false)}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] py-3 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-60"
                  >
                    No, volver
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
