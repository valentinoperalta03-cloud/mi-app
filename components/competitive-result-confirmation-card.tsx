"use client";

import { useActionState, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  recordMatchResultAction,
  type RecordMatchResultState,
} from "@/app/(player)/partidos/[id]/match-result-actions";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/client";

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
  const [levelChange, setLevelChange] = useState<number | null>(null);
  const [latestLevel, setLatestLevel] = useState<number | null>(null);
  const [baselineLevel, setBaselineLevel] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function fetchBaselineLevel() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from(DB_TABLES.profiles)
        .select("level")
        .eq("user_id", user.id)
        .maybeSingle();

      const level = Number((profile as { level?: number | null } | null)?.level ?? NaN);
      if (!active || !Number.isFinite(level)) return;
      setBaselineLevel(level);
      setLatestLevel(level);
    }

    void fetchBaselineLevel();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.ok || !state.message?.includes("confirmado")) return;

    const supabase = createClient();
    let active = true;
    async function fetchUpdatedLevel() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from(DB_TABLES.profiles)
        .select("level")
        .eq("user_id", user.id)
        .maybeSingle();

      const updated = Number((profile as { level?: number | null } | null)?.level ?? NaN);
      if (!active || !Number.isFinite(updated)) return;
      setLatestLevel(updated);
      if (baselineLevel != null) {
        setLevelChange(Number((updated - baselineLevel).toFixed(3)));
      }
    }

    void fetchUpdatedLevel();
    return () => {
      active = false;
    };
  }, [baselineLevel, state.ok, state.message]);

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
        Solo cuando los 4 validen se actualiza el ranking.
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
          style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
        >
          <p className="text-base font-semibold text-white">🏆 ¡Resultado confirmado!</p>
          <p className="mt-1 text-sm text-white/80">
            Tu nivel fue actualizado. Revisá tu perfil para ver la evolución.
          </p>
          {latestLevel != null ? (
            <p className="mt-2 text-sm font-semibold text-white">
              ELO actual: {latestLevel.toFixed(3)}
              {levelChange != null ? (
                <span className={levelChange >= 0 ? "text-emerald-200" : "text-rose-200"}>
                  {" "}
                  ({levelChange >= 0 ? "+" : ""}
                  {levelChange.toFixed(3)})
                </span>
              ) : null}
            </p>
          ) : null}
          <a
            href="/perfil"
            className="mt-3 inline-block rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
          >
            Ver mi evolución →
          </a>
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
