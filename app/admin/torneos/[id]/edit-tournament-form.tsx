"use client";

import { useState, useTransition } from "react";
import { adminCTAPrimary, adminKicker } from "@/components/admin/admin-premium";
import { CategoryChips, chip } from "../torneo-form";
import { PENA_WHAT_INCLUDES_OPTIONS } from "@/lib/tournament-constants";
import { updateTournamentAction } from "./actions";

export type EditableTournament = {
  id: string;
  tournamentType: string;
  name: string;
  startDate: string;
  endDate: string;
  startTime: string;
  registrationDeadline: string;
  maxPairs: number;
  pricePerPair: number;
  allowedCategories: string[];
  hasFinals: boolean;
  matchFormat: "set" | "tiempo";
  matchDurationMinutes: number | null;
  consolationBracket: boolean;
  multiDay: boolean;
  numCourts: number | null;
  foodIncluded: string | null;
  whatIncludes: string[];
};

export default function EditTournamentForm({
  tournament,
  onSuccess,
  onCancel,
}: {
  tournament: EditableTournament;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isPena = tournament.tournamentType === "pena";
  const isEliminacion = tournament.tournamentType === "eliminacion";
  const isAmericano = tournament.tournamentType === "americano";

  const [name, setName] = useState(tournament.name);
  const [startDate, setStartDate] = useState(tournament.startDate);
  const [startTime, setStartTime] = useState(tournament.startTime);
  const [deadline, setDeadline] = useState(
    tournament.registrationDeadline.slice(0, 10),
  );
  const [price, setPrice] = useState(tournament.pricePerPair);
  const [maxPairs, setMaxPairs] = useState(tournament.maxPairs);
  const [allowedCategories, setAllowedCategories] = useState<string[]>(
    tournament.allowedCategories,
  );
  const [hasFinals, setHasFinals] = useState(tournament.hasFinals);
  const [matchFormat, setMatchFormat] = useState<"set" | "tiempo">(
    tournament.matchFormat,
  );
  const [matchDuration, setMatchDuration] = useState(
    tournament.matchDurationMinutes ?? 20,
  );
  const [consolationBracket, setConsolationBracket] = useState(
    tournament.consolationBracket,
  );
  const [multiDay, setMultiDay] = useState(tournament.multiDay);
  const [endDate, setEndDate] = useState(tournament.endDate);
  const [numCourts, setNumCourts] = useState(tournament.numCourts ?? 2);
  const [foodIncluded, setFoodIncluded] = useState(
    tournament.foodIncluded ?? "",
  );
  const [whatIncludes, setWhatIncludes] = useState<string[]>(
    tournament.whatIncludes,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleCategory(cat: string) {
    setAllowedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function toggleInclude(item: string) {
    setWhatIncludes((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tournament_id", tournament.id);
      fd.set("name", name.trim());
      fd.set("start_date", startDate);
      fd.set("start_time", startTime);
      fd.set(
        "end_date",
        isEliminacion && multiDay ? endDate || startDate : startDate,
      );
      fd.set("registration_deadline", `${deadline || startDate}T00:00`);
      fd.set("price_per_pair", String(price));
      fd.set("max_pairs", String(maxPairs));
      fd.set("has_finals", String(hasFinals));
      fd.set("match_format", matchFormat);
      if (matchFormat === "tiempo")
        fd.set("match_duration_minutes", String(matchDuration));
      fd.set("consolation_bracket", String(consolationBracket));
      fd.set("multi_day", String(multiDay));
      if (isPena) {
        whatIncludes.forEach((item) => fd.append("what_includes", item));
        fd.set("num_courts", String(numCourts));
        if (foodIncluded.trim()) fd.set("food_included", foodIncluded.trim());
      } else {
        allowedCategories.forEach((c) => fd.append("allowed_categories", c));
      }

      const result = await updateTournamentAction(fd);
      if (result.ok) onSuccess();
      else setError(result.message);
    });
  }

  return (
    <div className="space-y-4 text-sm">
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Nombre del torneo
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            Fecha de inicio
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            Hora de inicio
          </span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Fecha límite de inscripción
        </span>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {isPena ? "Precio por jugador (ARS)" : "Precio por pareja (ARS)"}
        </span>
        <input
          type="number"
          min={0}
          step="100"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value) || 0)}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {isPena ? "Máximo de jugadores" : "Máximo de parejas"}
        </span>
        <input
          type="number"
          min={2}
          value={maxPairs}
          onChange={(e) => setMaxPairs(Number(e.target.value) || 0)}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      {!isPena ? (
        <CategoryChips
          selectedCategories={allowedCategories}
          onToggle={toggleCategory}
          onClear={() => setAllowedCategories([])}
        />
      ) : null}

      {isAmericano ? (
        <div>
          <label className={adminKicker}>¿Cómo termina el torneo?</label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setHasFinals(true)}
              className={chip(hasFinals)}
            >
              🏆 Con final y 3er puesto
            </button>
            <button
              type="button"
              onClick={() => setHasFinals(false)}
              className={chip(!hasFinals)}
            >
              📊 Solo ranking por puntos
            </button>
          </div>
        </div>
      ) : null}

      {isEliminacion ? (
        <>
          <div>
            <label className={adminKicker}>¿Copa de plata?</label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setConsolationBracket(true)}
                className={chip(consolationBracket)}
              >
                🥈 Sí
              </button>
              <button
                type="button"
                onClick={() => setConsolationBracket(false)}
                className={chip(!consolationBracket)}
              >
                ❌ No
              </button>
            </div>
          </div>
          <div>
            <label className={adminKicker}>¿Es de varios días?</label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMultiDay(false)}
                className={chip(!multiDay)}
              >
                📅 Un solo día
              </button>
              <button
                type="button"
                onClick={() => setMultiDay(true)}
                className={chip(multiDay)}
              >
                📅📅 Varios días
              </button>
            </div>
            {multiDay ? (
              <div className="mt-2">
                <label className={adminKicker}>Fecha de fin</label>
                <input
                  type="date"
                  value={endDate || startDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {isPena ? (
        <>
          <div>
            <label className={adminKicker}>Cantidad de canchas</label>
            <div className="mt-2 flex gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumCourts(n)}
                  className={chip(numCourts === n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <fieldset>
            <legend className="text-xs font-semibold text-[var(--text-secondary)]">
              ¿Qué incluye?
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PENA_WHAT_INCLUDES_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={whatIncludes.includes(opt)}
                    onChange={() => toggleInclude(opt)}
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    {opt}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              ¿Incluye algo más? (opcional)
            </span>
            <input
              type="text"
              value={foodIncluded}
              onChange={(e) => setFoodIncluded(e.target.value)}
              placeholder="Describí qué incluye la peña..."
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
        </>
      ) : null}

      {isAmericano || isPena ? (
        <div>
          <label className={adminKicker}>Formato de partidos</label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setMatchFormat("set")}
              className={chip(matchFormat === "set")}
            >
              🎾 A un set
            </button>
            <button
              type="button"
              onClick={() => setMatchFormat("tiempo")}
              className={chip(matchFormat === "tiempo")}
            >
              ⏱️ Por tiempo
            </button>
          </div>
          {matchFormat === "tiempo" ? (
            <div className="mt-2">
              <label className={adminKicker}>Duración (minutos)</label>
              <input
                type="number"
                min={5}
                max={60}
                step={5}
                value={matchDuration}
                onChange={(e) => setMatchDuration(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleSubmit}
          className={`flex-1 ${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
