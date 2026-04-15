"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  recordMatchResultAction,
  type RecordMatchResultState,
} from "@/app/(player)/matches/[id]/actions";

const initial: RecordMatchResultState = { ok: false, message: "" };

const FUN_FACTS = [
  "El padel nacio en Mexico en 1969, ya sos parte de la historia.",
  "Un set profesional de padel suele durar alrededor de 45 minutos.",
  "La comunicacion en dupla mejora mas rapido que cualquier golpe aislado.",
];

function SubmitRow({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}

export function MatchResultForm({
  matchId,
  teamALabel,
  teamBLabel,
  lockedByTeammate,
  alreadyStarted,
}: {
  matchId: string;
  teamALabel: string;
  teamBLabel: string;
  lockedByTeammate: boolean;
  alreadyStarted: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(recordMatchResultAction, initial);
  const [started, setStarted] = useState(alreadyStarted);
  const [sets, setSets] = useState([
    { a: 6, b: 4 },
    { a: 6, b: 2 },
  ]);

  const totals = useMemo(
    () => ({
      a: sets.reduce((acc, s) => acc + s.a, 0),
      b: sets.reduce((acc, s) => acc + s.b, 0),
    }),
    [sets]
  );
  const fact = FUN_FACTS[Math.abs(matchId.length) % FUN_FACTS.length]!;

  useEffect(() => {
    if (state.ok) {
      if (!started) setStarted(true);
      router.refresh();
    }
  }, [router, started, state.ok]);

  function adjustSet(idx: number, side: "a" | "b", delta: number) {
    setSets((prev) =>
      prev.map((set, i) =>
        i === idx ? { ...set, [side]: Math.max(0, Math.min(7, set[side] + delta)) } : set
      )
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          ¡Gran partido! ¿Quiénes se llevaron la victoria hoy?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {fact}
        </p>
      </div>

      {!started ? (
        <form action={formAction}>
          <input type="hidden" name="match_id" value={matchId} />
          <input type="hidden" name="intent" value="start" />
          <button
            type="submit"
            disabled={lockedByTeammate}
            className="w-full rounded-2xl bg-sky-600 py-3.5 text-base font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Cargar Resultado
          </button>
          {lockedByTeammate ? (
            <p className="mt-2 text-center text-sm font-medium text-amber-700">
              Tu pareja ya está cargando el resultado.
            </p>
          ) : null}
        </form>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="match_id" value={matchId} />
          <input type="hidden" name="intent" value="propose" />
          <input type="hidden" name="team_a_score" value={totals.a} />
          <input type="hidden" name="team_b_score" value={totals.b} />
          <input type="hidden" name="sets_json" value={JSON.stringify(sets)} />

          <div className="space-y-3">
            {[0, 1].map((idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Set {idx + 1}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-2 text-center">
                    <p className="text-[11px] font-semibold text-slate-500">Equipo A</p>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustSet(idx, "a", -1)}
                        className="h-7 w-7 rounded-full border border-slate-200 text-slate-700"
                      >
                        -
                      </button>
                      <span className="w-6 text-lg font-bold text-slate-900">{sets[idx]!.a}</span>
                      <button
                        type="button"
                        onClick={() => adjustSet(idx, "a", 1)}
                        className="h-7 w-7 rounded-full border border-slate-200 text-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-2 text-center">
                    <p className="text-[11px] font-semibold text-slate-500">Equipo B</p>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustSet(idx, "b", -1)}
                        className="h-7 w-7 rounded-full border border-slate-200 text-slate-700"
                      >
                        -
                      </button>
                      <span className="w-6 text-lg font-bold text-slate-900">{sets[idx]!.b}</span>
                      <button
                        type="button"
                        onClick={() => adjustSet(idx, "b", 1)}
                        className="h-7 w-7 rounded-full border border-slate-200 text-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <p>{teamALabel}: <span className="font-semibold">{totals.a}</span></p>
            <p>{teamBLabel}: <span className="font-semibold">{totals.b}</span></p>
          </div>

          <SubmitRow label="Enviar para confirmación" />
        </form>
      )}

      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-center text-xs font-medium ${
            state.ok ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
