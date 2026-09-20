"use client";

import { useState, useTransition } from "react";
import {
  adminBadgeLima,
  adminBadgeNeutral,
  adminBadgePending,
  adminButtonSecondary,
  adminCTAPrimary,
} from "@/components/admin/admin-premium";
import {
  createTiebreakMatchAction,
  generateBracketAction,
  generateQualifiersAction,
  generateZoneMatchesAction,
  previewQualifiersAction,
  resolveTiebreakAdminAction,
  saveMatchResultAction,
} from "./competitive-actions";
import { MatchSchedulerCard } from "./match-scheduler-card";

export type TiebreakMatchData = {
  id: string;
  zoneId: string | null;
  pair1Id: string | null;
  pair2Id: string | null;
  pair1Name: string;
  pair2Name: string;
  status: string;
  courtId: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

export type ZoneMatchData = {
  id: string;
  zoneName: string;
  pair1Id: string | null;
  pair2Id: string | null;
  pair1Name: string;
  pair2Name: string;
  status: string;
  games1: number | null;
  games2: number | null;
  isDraw: boolean;
  courtId: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

export type StandingRowData = {
  pairId: string;
  pairName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  gameDiff: number;
};

export type ZoneStandingsData = { zoneId: string; zoneName: string; rows: StandingRowData[] };

export type KnockoutMatchData = {
  id: string;
  round: number;
  roundName: string;
  pair1Id: string | null;
  pair2Id: string | null;
  pair1Name: string;
  pair2Name: string;
  status: string;
  winnerPairId: string | null;
  courtId: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

/** Resultado por tiempo (formato operacional por defecto, ver nota de match-format.ts). */
function TimedResultForm({
  tournamentId,
  matchId,
  allowDraw,
  defaultGames1,
  defaultGames2,
  onSaved,
}: {
  tournamentId: string;
  matchId: string;
  allowDraw: boolean;
  defaultGames1: number | null;
  defaultGames2: number | null;
  onSaved: () => void;
}) {
  const [g1, setG1] = useState(defaultGames1 ?? 0);
  const [g2, setG2] = useState(defaultGames2 ?? 0);
  const [tb, setTb] = useState<1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const needsTiebreak = !allowDraw && g1 === g2;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={0}
        value={g1}
        onChange={(e) => setG1(Number(e.target.value))}
        placeholder="Games P1"
        className="w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
      />
      <span className="text-xs text-[var(--text-tertiary)]">-</span>
      <input
        type="number"
        min={0}
        value={g2}
        onChange={(e) => setG2(Number(e.target.value))}
        placeholder="Games P2"
        className="w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
      />
      {needsTiebreak ? (
        <select
          value={tb ?? ""}
          onChange={(e) => setTb(e.target.value ? (Number(e.target.value) as 1 | 2) : null)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
        >
          <option value="">Desempate…</option>
          <option value="1">Ganó pareja 1</option>
          <option value="2">Ganó pareja 2</option>
        </select>
      ) : null}
      <button
        type="button"
        disabled={pending}
        className={`${adminCTAPrimary} px-2 py-1 text-xs disabled:opacity-50`}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await saveMatchResultAction(tournamentId, matchId, { kind: "timed", games1: g1, games2: g2, tiebreakWinner: tb });
            if (!res.ok) setError(res.message);
            else onSaved();
          });
        }}
      >
        {pending ? "Guardando…" : "Guardar resultado"}
      </button>
      {error ? <p className="w-full text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
}

export type SetsMatchFormat = { kind: "sets"; bestOf: 1 | 3; gamesPerSet: number; superTiebreakDecider: boolean };
export type TimedMatchFormat = { kind: "timed"; minutes: number };
export type UiMatchFormat = SetsMatchFormat | TimedMatchFormat;

/**
 * Carga de resultado a sets reales (games por set + super tie-break en el
 * set decisivo si el formato lo pide) — la validación deportiva vive en
 * validateMatchResult (lib/tournament/v2/results.ts), acá solo se arman los
 * inputs. Reemplaza a "cargar cuántos sets ganó cada uno" (que no permitía
 * reconstruir el resultado real ni detectar marcadores imposibles).
 */
export function SetsResultForm({
  onSubmit,
  pending,
  format,
}: {
  onSubmit: (sets: Array<{ p1: number; p2: number }>) => void;
  pending: boolean;
  format: SetsMatchFormat;
}) {
  const [sets, setSets] = useState<Array<{ p1: number; p2: number }>>(
    Array.from({ length: format.bestOf === 1 ? 1 : 2 }, () => ({ p1: 0, p2: 0 })),
  );

  function patchSet(i: number, patch: Partial<{ p1: number; p2: number }>) {
    setSets((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  const isDeciderSet = (i: number) => format.bestOf === 3 && i === 2 && format.superTiebreakDecider;

  return (
    <div className="mt-2 space-y-1.5">
      {sets.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-semibold text-[var(--text-tertiary)]">
            {isDeciderSet(i) ? "Super TB" : `Set ${i + 1}`}
          </span>
          <input
            type="number"
            min={0}
            value={s.p1}
            onChange={(e) => patchSet(i, { p1: Number(e.target.value) })}
            className="w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
          />
          <span className="text-xs text-[var(--text-tertiary)]">-</span>
          <input
            type="number"
            min={0}
            value={s.p2}
            onChange={(e) => patchSet(i, { p2: Number(e.target.value) })}
            className="w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {sets.length < format.bestOf ? (
          <button
            type="button"
            onClick={() => setSets((prev) => [...prev, { p1: 0, p2: 0 }])}
            className={`${adminButtonSecondary} px-2 py-1 text-xs`}
          >
            + Agregar set
          </button>
        ) : null}
        {sets.length > 1 ? (
          <button
            type="button"
            onClick={() => setSets((prev) => prev.slice(0, -1))}
            className="text-xs font-semibold text-rose-500"
          >
            Quitar último set
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className={`${adminCTAPrimary} px-2 py-1 text-xs disabled:opacity-50`}
          onClick={() => onSubmit(sets)}
        >
          {pending ? "Guardando…" : "Guardar resultado"}
        </button>
      </div>
    </div>
  );
}

/** Elige sets vs. tiempo según el formato configurado y llama saveMatchResultAction. */
function ResultEntry({
  tournamentId,
  matchId,
  allowDraw,
  format,
  onSaved,
}: {
  tournamentId: string;
  matchId: string;
  allowDraw: boolean;
  format: UiMatchFormat;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (format.kind === "sets") {
    return (
      <div>
        <SetsResultForm
          format={format}
          pending={pending}
          onSubmit={(sets) => {
            setError(null);
            start(async () => {
              const res = await saveMatchResultAction(tournamentId, matchId, { kind: "sets", sets });
              if (!res.ok) setError(res.message);
              else onSaved();
            });
          }}
        />
        {error ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
      </div>
    );
  }
  return <TimedResultForm tournamentId={tournamentId} matchId={matchId} allowDraw={allowDraw} defaultGames1={null} defaultGames2={null} onSaved={onSaved} />;
}

function StandingsTable({ zone }: { zone: ZoneStandingsData }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">Zona {zone.zoneName}</p>
      <table className="mt-1 w-full min-w-[420px] text-xs">
        <thead>
          <tr className="text-left text-[var(--text-tertiary)]">
            <th className="py-1 pr-2">Pareja</th>
            <th className="px-1 text-center">PJ</th>
            <th className="px-1 text-center">G</th>
            <th className="px-1 text-center">E</th>
            <th className="px-1 text-center">P</th>
            <th className="px-1 text-center">Dif</th>
            <th className="px-1 text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {zone.rows.map((r, i) => (
            <tr key={r.pairId} className="border-t border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <td className="py-1 pr-2">
                {i + 1}° {r.pairName}
              </td>
              <td className="px-1 text-center">{r.played}</td>
              <td className="px-1 text-center">{r.won}</td>
              <td className="px-1 text-center">{r.drawn}</td>
              <td className="px-1 text-center">{r.lost}</td>
              <td className="px-1 text-center">{r.gameDiff}</td>
              <td className="px-1 text-center font-semibold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CategoryCompetitivePanel({
  tournamentId,
  clubId,
  courts,
  categoryId,
  zonesCount,
  hasZoneMatches,
  zoneMatches,
  standingsByZone,
  qualifiedCount,
  qualifiersGeneratedAt,
  bracketSizeOptions,
  knockoutMatches,
  championName,
  zoneFormat,
  knockoutFormat,
  finalFormat,
  tiebreakMatches,
  pairNames,
}: {
  tournamentId: string;
  clubId: string;
  courts: Array<{ id: string; name: string }>;
  categoryId: string;
  zonesCount: number;
  hasZoneMatches: boolean;
  zoneMatches: ZoneMatchData[];
  standingsByZone: ZoneStandingsData[];
  qualifiedCount: number;
  qualifiersGeneratedAt: string | null;
  bracketSizeOptions: number[];
  knockoutMatches: KnockoutMatchData[];
  /** Formato real (sets con games/super TB, o tiempo) resuelto server-side — ver lib/tournament/v2/match-format.ts. */
  zoneFormat: UiMatchFormat;
  knockoutFormat: UiMatchFormat;
  finalFormat: UiMatchFormat;
  championName: string | null;
  tiebreakMatches: TiebreakMatchData[];
  pairNames: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingTies, setPendingTies] = useState<Array<{ kind: string; pairIds: string[]; message: string }> | null>(null);
  const [bracketSize, setBracketSize] = useState<number | null>(bracketSizeOptions[bracketSizeOptions.length - 1] ?? null);
  const [pending, start] = useTransition();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  if (zonesCount === 0) return null;

  const allZoneMatchesFinished = zoneMatches.length > 0 && zoneMatches.every((m) => m.status === "finished");
  const hasBracket = knockoutMatches.length > 0;

  return (
    <div className="mt-4 space-y-4 border-t border-dashed border-[var(--border-subtle)] pt-4">
      <div>
        <p className="text-xs font-semibold text-[var(--text-secondary)]">Partidos de zona</p>
        {!hasZoneMatches ? (
          <button
            type="button"
            disabled={pending}
            className={`${adminButtonSecondary} mt-2`}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await generateZoneMatchesAction(tournamentId, categoryId);
                if (!res.ok) setError(res.message);
                else refresh();
              });
            }}
          >
            {pending ? "Generando…" : "Generar partidos de zona"}
          </button>
        ) : (
          <ul className="mt-2 space-y-2" key={tick}>
            {zoneMatches.map((m) => (
              <li key={m.id} className="rounded-xl border border-[var(--border-subtle)] p-2 text-xs">
                <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">Zona {m.zoneName}</p>
                <p className="text-[var(--text-secondary)]">
                  {m.pair1Name} vs {m.pair2Name}
                </p>
                <span className={m.status === "finished" ? adminBadgeLima : adminBadgeNeutral}>
                  {m.status === "finished" ? (m.isDraw ? `Empate ${m.games1}-${m.games2}` : `${m.games1}-${m.games2}`) : "Pendiente"}
                </span>
                {m.status !== "finished" && m.pair1Id && m.pair2Id ? (
                  <ul className="mt-2">
                    <MatchSchedulerCard
                      tournamentId={tournamentId}
                      clubId={clubId}
                      courts={courts}
                      wrapperClassName=""
                      match={{
                        id: m.id,
                        label: `Zona ${m.zoneName}`,
                        pair1_name: m.pair1Name,
                        pair2_name: m.pair2Name,
                        court_id: m.courtId,
                        scheduled_date: m.scheduledDate,
                        scheduled_time: m.scheduledTime,
                      }}
                    />
                  </ul>
                ) : m.courtId && m.scheduledDate && m.scheduledTime ? (
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                    {m.scheduledDate} · {m.scheduledTime}hs
                  </p>
                ) : null}
                {m.pair1Id && m.pair2Id ? (
                  <ResultEntry tournamentId={tournamentId} matchId={m.id} allowDraw format={zoneFormat} onSaved={refresh} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {standingsByZone.length > 0 && standingsByZone.some((z) => z.rows.length > 0) ? (
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Tabla de posiciones</p>
          {standingsByZone.map((z) => (
            <StandingsTable key={z.zoneId} zone={z} />
          ))}
        </div>
      ) : null}

      {allZoneMatchesFinished && !hasBracket ? (
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Clasificados</p>
          {qualifiedCount > 0 ? (
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{qualifiedCount} parejas clasificadas.</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                {bracketSizeOptions.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBracketSize(size)}
                    className={`rounded-full border px-3 py-1 text-xs ${bracketSize === size ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
                  >
                    Cuadro de {size}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!bracketSize || pending}
                className={`${adminCTAPrimary} mt-2 disabled:opacity-50`}
                onClick={() => {
                  if (!bracketSize) return;
                  setError(null);
                  setPendingTies(null);
                  start(async () => {
                    const preview = await previewQualifiersAction(tournamentId, categoryId, bracketSize);
                    if (!preview.ok) {
                      if ("pending" in preview && preview.pending?.length) {
                        setPendingTies(preview.pending);
                        setError(preview.message);
                      } else {
                        setError(preview.message);
                      }
                      return;
                    }
                    const res = await generateQualifiersAction(tournamentId, categoryId, bracketSize);
                    if (!res.ok) setError(res.message);
                    else refresh();
                  });
                }}
              >
                {pending ? "Calculando…" : "Generar clasificados"}
              </button>
              {pendingTies?.length ? (
                <div className="mt-2 space-y-2">
                  {pendingTies.map((t, i) => (
                    <TiebreakResolver
                      key={i}
                      tournamentId={tournamentId}
                      categoryId={categoryId}
                      pending={t}
                      pairNames={pairNames}
                      tiebreakMatches={tiebreakMatches}
                      format={zoneFormat}
                      onResolved={refresh}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {qualifiedCount > 0 && !hasBracket ? (
        <button
          type="button"
          disabled={pending}
          className={`${adminCTAPrimary} disabled:opacity-50`}
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await generateBracketAction(tournamentId, categoryId);
              if (!res.ok) setError(res.message);
              else refresh();
            });
          }}
        >
          {pending ? "Generando…" : "Generar cuadro eliminatorio"}
        </button>
      ) : null}

      {hasBracket ? (
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Cuadro eliminatorio</p>
          <ul className="mt-2 space-y-2">
            {(() => {
              const maxRound = Math.max(...knockoutMatches.map((m) => m.round));
              return knockoutMatches.map((m) => renderKnockoutMatch(m, m.round === maxRound));
            })()}
          </ul>
        </div>
      ) : null}

      {championName ? (
        <div className={`${adminBadgeLima} inline-flex text-sm`}>🏆 Campeón: {championName}</div>
      ) : null}

      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
      {qualifiersGeneratedAt && qualifiedCount === 0 ? null : null}
    </div>
  );

  function renderKnockoutMatch(m: KnockoutMatchData, isFinal: boolean) {
    return (
      <li key={m.id} className="rounded-xl border border-[var(--border-subtle)] p-2 text-xs">
        <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">{m.roundName}</p>
        <p className="text-[var(--text-secondary)]">
          {m.pair1Name} vs {m.pair2Name}
        </p>
        <span className={m.status === "finished" ? adminBadgeLima : m.pair1Id && m.pair2Id ? adminBadgeNeutral : adminBadgePending}>
          {m.status === "finished" ? "✓ Finalizado" : m.pair1Id && m.pair2Id ? "Pendiente" : "Esperando rival"}
        </span>
        {m.status !== "finished" && m.pair1Id && m.pair2Id ? (
          <ul className="mt-2">
            <MatchSchedulerCard
              tournamentId={tournamentId}
              clubId={clubId}
              courts={courts}
              wrapperClassName=""
              match={{
                id: m.id,
                label: m.roundName,
                pair1_name: m.pair1Name,
                pair2_name: m.pair2Name,
                court_id: m.courtId,
                scheduled_date: m.scheduledDate,
                scheduled_time: m.scheduledTime,
              }}
            />
          </ul>
        ) : m.courtId && m.scheduledDate && m.scheduledTime ? (
          <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
            {m.scheduledDate} · {m.scheduledTime}hs
          </p>
        ) : null}
        {m.pair1Id && m.pair2Id ? (
          <ResultEntry tournamentId={tournamentId} matchId={m.id} allowDraw={false} format={isFinal ? finalFormat : knockoutFormat} onSaved={refresh} />
        ) : null}
      </li>
    );
  }
}

/**
 * Resolución de un desempate absoluto (sección 25.2): el club elige entre
 * jugar un partido de desempate (createTiebreakMatchAction, se carga su
 * resultado con la misma validación deportiva que cualquier otro partido) o
 * una resolución administrativa registrada con motivo obligatorio
 * (resolveTiebreakAdminAction). Ninguna de las dos vías clasifica a nadie
 * arbitrariamente — selectQualifiers exige que la resolución cubra
 * exactamente el mismo grupo de parejas empatadas.
 */
function TiebreakResolver({
  tournamentId,
  categoryId,
  pending,
  pairNames,
  tiebreakMatches,
  format,
  onResolved,
}: {
  tournamentId: string;
  categoryId: string;
  pending: { kind: string; pairIds: string[]; message: string };
  pairNames: Record<string, string>;
  tiebreakMatches: TiebreakMatchData[];
  format: UiMatchFormat;
  onResolved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending_, start] = useTransition();
  const [order, setOrder] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  const key = [...pending.pairIds].sort().join(",");
  const existingMatch = tiebreakMatches.find(
    (m) => m.pair1Id && m.pair2Id && [m.pair1Id, m.pair2Id].sort().join(",") === key,
  );

  function toggleOrder(pairId: string) {
    setOrder((prev) => (prev.includes(pairId) ? prev.filter((id) => id !== pairId) : [...prev, pairId]));
  }

  if (existingMatch) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/30">
        <p className="font-semibold text-amber-800 dark:text-amber-200">{pending.message}</p>
        <p className="mt-1 text-amber-700 dark:text-amber-300">
          Partido de desempate: {existingMatch.pair1Name} vs {existingMatch.pair2Name}
        </p>
        {existingMatch.status === "finished" ? (
          <p className="mt-1 font-semibold text-amber-800 dark:text-amber-200">
            Ya se jugó — volvé a presionar &quot;Generar clasificados&quot; para aplicarlo.
          </p>
        ) : (
          <ResultEntry tournamentId={tournamentId} matchId={existingMatch.id} allowDraw={false} format={format} onSaved={onResolved} />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/30">
      <p className="font-semibold text-amber-800 dark:text-amber-200">{pending.message}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {pending.pairIds.length === 2 ? (
          <button
            type="button"
            disabled={pending_}
            className={`${adminButtonSecondary} px-2 py-1 text-xs`}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await createTiebreakMatchAction(tournamentId, categoryId, null, pending.pairIds[0], pending.pairIds[1]);
                if (!res.ok) setError(res.message);
                else onResolved();
              });
            }}
          >
            Jugar partido de desempate
          </button>
        ) : null}
        <button type="button" className={`${adminButtonSecondary} px-2 py-1 text-xs`} onClick={() => setShowAdmin((v) => !v)}>
          Resolución administrativa
        </button>
      </div>

      {showAdmin ? (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-amber-700 dark:text-amber-300">Elegí el orden (mejor primero) haciendo click en cada pareja:</p>
          <div className="flex flex-wrap gap-2">
            {pending.pairIds.map((pid) => {
              const rank = order.indexOf(pid);
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => toggleOrder(pid)}
                  className={`rounded-full border px-3 py-1 text-xs ${rank >= 0 ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
                >
                  {rank >= 0 ? `${rank + 1}° ` : ""}
                  {pairNames[pid] ?? "Pareja"}
                </button>
              );
            })}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo de la resolución (obligatorio)"
            rows={2}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
          />
          <button
            type="button"
            disabled={pending_ || order.length !== pending.pairIds.length || !reason.trim()}
            className={`${adminCTAPrimary} px-2 py-1 text-xs disabled:opacity-50`}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await resolveTiebreakAdminAction(tournamentId, categoryId, pending.pairIds, order, reason.trim());
                if (!res.ok) setError(res.message);
                else onResolved();
              });
            }}
          >
            {pending_ ? "Guardando…" : "Registrar resolución"}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-1 text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
}
