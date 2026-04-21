"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createMatchAction, type CreateMatchActionState } from "./actions";

type ClubOption = {
  id: string;
  name: string;
  location: string;
};

type CourtOption = {
  id: string;
  club_id: string;
  name: string;
};

const initialState: CreateMatchActionState = { success: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-3xl bg-gradient-to-r from-[#0585FC] to-cyan-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition-all duration-300 hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creando partido..." : "Crear partido"}
    </button>
  );
}

type CreateMatchFormProps = {
  clubs: ClubOption[];
  courts: CourtOption[];
  defaultDate: string;
};

export default function CreateMatchForm({
  clubs,
  courts,
  defaultDate,
}: CreateMatchFormProps) {
  const [state, formAction] = useActionState(createMatchAction, initialState);
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.id ?? "");

  const availableCourts = useMemo(
    () => courts.filter((court) => court.club_id === selectedClubId),
    [courts, selectedClubId]
  );

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)]"
    >
      <div className="space-y-2">
        <label htmlFor="club_id" className="text-sm font-semibold text-slate-800">
          Club
        </label>
        <select
          id="club_id"
          name="club_id"
          required
          value={selectedClubId}
          onChange={(event) => setSelectedClubId(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
        >
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name} - {club.location}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="court_id" className="text-sm font-semibold text-slate-800">
          Cancha
        </label>
        <select
          id="court_id"
          name="court_id"
          key={selectedClubId}
          required
          disabled={availableCourts.length === 0}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          {availableCourts.length === 0 ? (
            <option value="">No hay canchas para este club</option>
          ) : (
            availableCourts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="match_date" className="text-sm font-semibold text-slate-800">
          Fecha
        </label>
        <input
          id="match_date"
          name="match_date"
          type="date"
          min={defaultDate}
          defaultValue={defaultDate}
          required
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="match_time" className="text-sm font-semibold text-slate-800">
          Hora
        </label>
        <input
          id="match_time"
          name="match_time"
          type="time"
          required
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold text-slate-800">
              Tipo de partido
            </span>
            <span className="text-xs text-slate-500">Competitivo vs Amistoso</span>
          </span>
          <input
            name="is_competitive"
            type="checkbox"
            className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-slate-300 transition before:inline-block before:h-5 before:w-5 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition checked:bg-[#0585FC]/50 checked:before:translate-x-5"
          />
        </label>

      </div>

      {state.message ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
