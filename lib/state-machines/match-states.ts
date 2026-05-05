import { log } from "@/lib/logger";
import { sendAlert } from "@/lib/alerts";
import { IllegalTransitionError } from "@/lib/state-machines/errors";

/** Estados de `matches.match_status` usados en la app. */
export const MATCH_STATUSES = [
  "pending",
  "scheduled",
  "full",
  "reserved",
  "cancelled",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

const ALLOWED: Record<string, Set<string>> = {
  pending: new Set(["scheduled", "cancelled", "full", "reserved"]),
  scheduled: new Set(["full", "reserved", "cancelled", "pending"]),
  full: new Set(["reserved", "cancelled", "scheduled"]),
  reserved: new Set(["cancelled"]),
  cancelled: new Set([]),
};

function normalize(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

export function canTransitionMatch(from: string | null | undefined, to: string | null | undefined): boolean {
  const f = normalize(from) || "pending";
  const t = normalize(to);
  if (f === t) return true;
  return (ALLOWED[f] ?? new Set()).has(t);
}

export function assertMatchTransition(
  from: string | null | undefined,
  to: string | null | undefined,
  ctx?: { requestId?: string; matchId?: string; trigger?: string }
): void {
  const f = normalize(from) || "pending";
  const t = normalize(to);
  if (f === t) return;
  if (canTransitionMatch(f, t)) {
    log.info({
      event: "transition.match_status",
      from: f,
      to: t,
      trigger: ctx?.trigger,
      requestId: ctx?.requestId,
      matchId: ctx?.matchId,
    });
    return;
  }
  const err = new IllegalTransitionError("match", f, t);
  log.error({
    event: "transition.match_status.illegal",
    from: f,
    to: t,
    trigger: ctx?.trigger,
    requestId: ctx?.requestId,
    matchId: ctx?.matchId,
    err,
  });
  void sendAlert({
    source: "app",
    kind: "state_machine",
    title: "Transición de partido no permitida",
    detail: `${f} → ${t} (match ${ctx?.matchId ?? "?"})`,
    requestId: ctx?.requestId,
  });
  throw err;
}
