"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useTransition } from "react";
import { nativeOpenUrl } from "@/lib/native-open";
import { requestToJoin } from "./actions";

type Props = {
  matchId: string;
  team1Count: number;
  team2Count: number;
  submitLabel?: string;
  levelOverride?: boolean;
};

export default function JoinWithTeamForm({
  matchId,
  team1Count,
  team2Count,
  submitLabel,
  levelOverride = false,
}: Props) {
  const t1Full = team1Count >= 2;
  const t2Full = team2Count >= 2;
  const t1Free = Math.max(0, 2 - team1Count);
  const t2Free = Math.max(0, 2 - team2Count);
  const getSlotLabel = (free: number) => {
    if (free <= 0) return "Completo";
    return `${free} lugar${free === 1 ? "" : "es"} libre${free === 1 ? "" : "s"}`;
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Elegí a qué equipo querés unirte.</p>
      <div className="grid grid-cols-2 gap-3">
        <TeamJoinButton
          matchId={matchId}
          team={1}
          disabled={t1Full}
          levelOverride={levelOverride}
          label={submitLabel ?? "Unirme al Equipo 1"}
          slotLabel={getSlotLabel(t1Free)}
          tone="blue"
        />
        <TeamJoinButton
          matchId={matchId}
          team={2}
          disabled={t2Full}
          levelOverride={levelOverride}
          label={submitLabel ?? "Unirme al Equipo 2"}
          slotLabel={getSlotLabel(t2Free)}
          tone="slate"
        />
      </div>
    </div>
  );
}

function TeamJoinButton({
  matchId,
  team,
  disabled,
  levelOverride,
  label,
  slotLabel,
  tone,
}: {
  matchId: string;
  team: 1 | 2;
  disabled: boolean;
  levelOverride: boolean;
  label: string;
  slotLabel: string;
  tone: "blue" | "slate";
}) {
  const [isPending, startTransition] = useTransition();
  const isDisabled = disabled || isPending;
  const toneClass =
    tone === "blue"
      ? "border-[#0085FC]/30 bg-[#0085FC] text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)] hover:brightness-95"
      : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";

  function handleClick() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("match_id", matchId);
        fd.set("level_override", levelOverride ? "true" : "false");
        fd.set("team", String(team));

        const result = await requestToJoin(fd);

        if (result && "needsPayment" in result && result.mpUrl) {
          await nativeOpenUrl(result.mpUrl);
        }
        // Si no devuelve nada → la action hizo redirect() internamente
      } catch (err) {
        if (isRedirectError(err)) throw err;
        console.error("[JoinWithTeamForm]", err);
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handleClick}
      className={`w-full rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${toneClass}`}
    >
      <span className="block truncate">{isPending ? "Enviando..." : label}</span>
      <span className="mt-1 block text-xs font-medium opacity-90">{slotLabel}</span>
    </button>
  );
}
