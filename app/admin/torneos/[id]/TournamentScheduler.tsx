"use client";

import { useState } from "react";
import { adminCard } from "@/components/admin/admin-premium";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import {
  assignTournamentMatchSlot,
  getCourtAvailabilityForDate,
} from "./actions";

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

function AvailabilityGrid({
  courts,
  slots,
  occupiedByCourtAndSlot,
  selectedCourtId,
  selectedTime,
  onSelect,
}: {
  courts: Court[];
  slots: string[];
  occupiedByCourtAndSlot: Record<string, Record<string, string>>;
  selectedCourtId: string | null;
  selectedTime: string | null;
  onSelect: (courtId: string, time: string) => void;
}) {
  if (slots.length === 0) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]">
        No hay horarios configurados para esta fecha.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="w-16 py-1 text-left font-mono text-[var(--text-tertiary)]">
              Hora
            </th>
            {courts.map((c) => (
              <th
                key={c.id}
                className="px-2 py-1 text-center font-semibold text-[var(--text-secondary)]"
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot} className="border-t border-[var(--border-subtle)]">
              <td className="py-1.5 pr-3 font-mono text-[var(--text-tertiary)]">
                {slot}
              </td>
              {courts.map((court) => {
                const motivo = occupiedByCourtAndSlot[court.id]?.[slot];
                const isSelected =
                  selectedCourtId === court.id && selectedTime === slot;
                const isOcupado = Boolean(motivo);

                return (
                  <td key={court.id} className="px-1 py-1">
                    <button
                      type="button"
                      disabled={isOcupado}
                      onClick={() => !isOcupado && onSelect(court.id, slot)}
                      className={`w-full rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold transition ${
                        isSelected
                          ? "bg-[#0085FC] text-white"
                          : isOcupado
                            ? "cursor-not-allowed bg-rose-500/15 text-rose-400"
                            : "cursor-pointer bg-[var(--bg-subtle)] text-[var(--text-tertiary)] hover:bg-[#0085FC]/15 hover:text-[#0085FC]"
                      }`}
                    >
                      {isSelected ? "✓ Asignado" : isOcupado ? motivo : "Libre"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
