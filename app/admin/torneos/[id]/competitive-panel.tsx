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
  generateBracketAction,
  generateQualifiersAction,
  generateZoneMatchesAction,
  previewQualifiersAction,
  saveMatchResultAction,
} from "./competitive-actions";
import { MatchSchedulerCard } from "./match-scheduler-card";

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
  championName: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingTies, setPendingTies] = useState<Array<{ message: string }> | null>(null);
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
                  <TimedResultForm
                    tournamentId={tournamentId}
                    matchId={m.id}
                    allowDraw
                    defaultGames1={m.games1}
                    defaultGames2={m.games2}
                    onSaved={refresh}
                  />
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
                <ul className="mt-2 space-y-1 text-xs text-amber-600 dark:text-amber-400">
                  {pendingTies.map((t, i) => (
                    <li key={i}>{t.message}</li>
                  ))}
                </ul>
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
            {knockoutMatches.map((m) => (
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
                  <TimedResultForm tournamentId={tournamentId} matchId={m.id} allowDraw={false} defaultGames1={null} defaultGames2={null} onSaved={refresh} />
                ) : null}
              </li>
            ))}
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
}
