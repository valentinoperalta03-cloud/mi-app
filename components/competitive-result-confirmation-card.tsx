"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import {
  recordMatchResultAction,
  type RecordMatchResultState,
} from "@/app/(player)/partidos/[id]/match-result-actions";

const initial: RecordMatchResultState = { ok: false, message: "" };

export function CompetitiveResultConfirmationCard(props: {
  matchId: string;
  label: string;
  scoreLabel: string;
  confirmCount?: number;
  totalPlayers?: number;
}) {
  const { matchId, label, scoreLabel, confirmCount, totalPlayers } = props;
  const [state, formAction] = useActionState(recordMatchResultAction, initial);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      {state.ok ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.18),transparent_35%)]"
        />
      ) : null}
      <p className="text-sm font-semibold text-slate-900">¿Confirmás el {scoreLabel} contra {label}?</p>
      <p className="mt-1 text-xs text-slate-500">
        Solo cuando los 4 validen se confirma el resultado.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <form action={formAction}>
          <input type="hidden" name="match_id" value={matchId} />
          <input type="hidden" name="intent" value="confirm" />
          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Confirmar
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="match_id" value={matchId} />
          <input type="hidden" name="intent" value="dispute" />
          <button
            type="submit"
            className="w-full rounded-2xl bg-rose-600 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            Disputar
          </button>
        </form>
      </div>

      {state.ok ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl p-4 text-center"
          style={{ background: "linear-gradient(135deg, #0085FC 0%, #0461C4 100%)" }}
        >
          <p className="text-base font-semibold text-white">🏆 ¡Resultado confirmado!</p>
        </motion.div>
      ) : null}

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-500 text-center mb-2">
          Confirmaciones: {confirmCount ?? 0}/4
        </p>
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPlayers ?? 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full ${
                i < (confirmCount ?? 0)
                  ? "bg-emerald-500"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      {state.message ? (
        <p className={`mt-2 text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
