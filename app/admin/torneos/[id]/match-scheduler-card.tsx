"use client";

import { useState } from "react";
import { adminCard } from "@/components/admin/admin-premium";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { getCourtAvailabilityForDate } from "@/lib/tournament-availability";
import { AvailabilityGrid } from "../availability-grid";
import { assignTournamentMatchSlot } from "./actions";

type Court = { id: string; name: string };

export type SchedulableMatch = {
  id: string;
  label: string;
  pair1_name: string;
  pair2_name: string;
  court_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
};

type Availability = {
  slots: string[];
  occupiedByCourtAndSlot: Record<string, Record<string, string>>;
};

/**
 * Tarjeta de asignación de cancha/fecha/hora para UN partido de torneo.
 * Compartida por el flujo legacy (TournamentScheduler) y el panel
 * competitivo V2 (partidos de zona y de cuadro): la RPC
 * tournament_assign_match_slot no distingue de dónde viene el partido.
 */
export function MatchSchedulerCard({
  tournamentId,
  clubId,
  courts,
  match,
  wrapperClassName = adminCard,
}: {
  tournamentId: string;
  clubId: string;
  courts: Court[];
  match: SchedulableMatch;
  wrapperClassName?: string;
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
    const avail = await getCourtAvailabilityForDate(clubId, courtIds, date, match.id);
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
        match.id,
      );
      setAvailability(avail);
    } else {
      setError(result.error ?? "Error al asignar");
    }
  }

  return (
    <li className={wrapperClassName}>
      <p className="text-xs font-semibold text-[var(--text-tertiary)]">{match.label}</p>
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
        ) : (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Sin programar</p>
        )}

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
