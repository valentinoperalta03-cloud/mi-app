"use client";

import { adminCard } from "@/components/admin/admin-premium";
import { MatchSchedulerCard } from "./match-scheduler-card";

type Court = { id: string; name: string };

type MatchRow = {
  id: string;
  round_name: string | null;
  pair1_name: string;
  pair2_name: string;
  court_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
};

type Props = {
  tournamentId: string;
  clubId: string;
  matches: MatchRow[];
  courts: Court[];
};

export function TournamentScheduler({
  tournamentId,
  clubId,
  matches,
  courts,
}: Props) {
  const playableMatches = matches.filter(
    (m) => m.pair1_name !== "—" && m.pair2_name !== "—",
  );

  if (playableMatches.length === 0) {
    return (
      <section>
        <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
          Canchas y horarios
        </h2>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          No hay partidos con parejas asignadas aun.
        </p>
      </section>
    );
  }

  if (courts.length === 0) {
    return (
      <section>
        <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
          Canchas y horarios
        </h2>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          Todavía no tenés canchas configuradas.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
        Canchas y horarios
      </h2>
      <ul className="mt-3 space-y-3">
        {playableMatches.map((m) => (
          <MatchSchedulerCard
            key={m.id}
            tournamentId={tournamentId}
            clubId={clubId}
            courts={courts}
            wrapperClassName={adminCard}
            match={{
              id: m.id,
              label: m.round_name ?? "Partido",
              pair1_name: m.pair1_name,
              pair2_name: m.pair2_name,
              court_id: m.court_id,
              scheduled_date: m.scheduled_date,
              scheduled_time: m.scheduled_time,
            }}
          />
        ))}
      </ul>
    </section>
  );
}
