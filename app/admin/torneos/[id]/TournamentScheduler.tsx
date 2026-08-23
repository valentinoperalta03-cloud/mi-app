"use client";

import { useState } from "react";
import { adminCard } from "@/components/admin/admin-premium";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { getCourtAvailabilityForDate } from "@/lib/tournament-availability";
import { AvailabilityGrid } from "../availability-grid";
import { assignTournamentMatchSlot } from "./actions";

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

type Availability = {
  slots: string[];
  occupiedByCourtAndSlot: Record<string, Record<string, string>>;
};

function MatchSchedulerCard({
  tournamentId,
  clubId,
  courts,
  match,
}: {
  tournamentId: string;
  clubId: string;
  courts: Court[];
  match: MatchRow;
}) {
  const [selectedDate, setSelectedDate] = useState(match.scheduled_date ?? "");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [assignedCourtId, setAssignedCourtId] = useState(
    match.court_id ?? null,
  );
  const [assignedTime, setAssignedTime] = useState(
    match.scheduled_time ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleDateChange(date: string) {
    setSelectedDate(date);
    setError(null);
    if (!date) {
      setAvailability(null);
      return;
    }
    setLoadingAvail(true);
    const courtIds = courts.map((c) => c.id);
    const avail = await getCourtAvailabilityForDate(clubId, courtIds, date);
    setAvailability(avail);
    setLoadingAvail(false);
  }

  async function handleSelect(courtId: string, time: string) {
    setError(null);
    const result = await assignTournamentMatchSlot({
      matchId: match.id,
      courtId,
      matchDate: selectedDate,
      matchTime: time,
      clubId,
      tournamentId,
    });
    if (result.ok) {
      setAssignedCourtId(courtId);
      setAssignedTime(time);
      const avail = await getCourtAvailabilityForDate(
        clubId,
        courts.map((c) => c.id),
        selectedDate,
      );
      setAvailability(avail);
    } else {
      setError(result.error ?? "Error al asignar");
    }
  }

  return (
    <li className={adminCard}>
      <p className="text-xs font-semibold text-[var(--text-tertiary)]">
        {match.round_name ?? "Partido"}
      </p>
      <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">
        {match.pair1_name} vs {match.pair2_name}
      </p>

      <div className="mt-2 space-y-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          min={getTodayYmdInArgentina()}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />

        {assignedCourtId && assignedTime ? (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ✓ {courts.find((c) => c.id === assignedCourtId)?.name} ·{" "}
            {assignedTime}hs
            {selectedDate ? ` · ${selectedDate}` : ""}
          </p>
        ) : null}

        {error ? (
          <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        {loadingAvail ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0085FC] border-t-transparent" />
            Cargando disponibilidad...
          </div>
        ) : availability ? (
          <AvailabilityGrid
            courts={courts}
            slots={availability.slots}
            occupiedByCourtAndSlot={availability.occupiedByCourtAndSlot}
            selectedCourtId={assignedCourtId}
            selectedTime={assignedTime}
            onSelect={handleSelect}
          />
        ) : null}
      </div>
    </li>
  );
}

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
            match={m}
          />
        ))}
      </ul>
    </section>
  );
}
