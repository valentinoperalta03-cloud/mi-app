"use client";

import { useState, useTransition } from "react";
import {
  adminCard,
  adminCTAPrimary,
  adminKicker,
  adminPressable,
} from "@/components/admin/admin-premium";
import { PROFILE_CATEGORIES } from "@/lib/profile-display";
import {
  MAX_PAIRS_OPTIONS,
  PENA_MAX_PLAYERS_OPTIONS,
  PENA_WHAT_INCLUDES_OPTIONS,
  TOURNAMENT_TYPE_OPTIONS,
  type TournamentTypeKey,
} from "@/lib/tournament-constants";
import { createTournamentAction } from "./actions";

export const CATEGORY_OPTIONS = PROFILE_CATEGORIES.slice().reverse();

const TYPE_EMOJI: Record<TournamentTypeKey, string> = {
  americano: "🏆",
  eliminacion: "⚡",
  pena: "🎉",
};

const TYPE_DESCRIPTION: Record<TournamentTypeKey, string> = {
  americano: "Todos juegan contra todos. Ideal para grupos de amigos.",
  eliminacion: "Eliminación directa. El que pierde queda afuera.",
  pena: "Formato social con comida y bebida incluida.",
};

export function chip(active: boolean) {
  return `rounded-xl border px-3 py-2 text-sm font-semibold transition ${
    active
      ? "border-[#0085FC]/30 bg-[#0085FC]/10 text-[#0085FC]"
      : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
  }`;
}

export function CategoryChips({
  selectedCategories,
  onToggle,
  onClear,
}: {
  selectedCategories: string[];
  onToggle: (cat: string) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-[var(--text-secondary)]">
        Categorías permitidas
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClear}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            selectedCategories.length === 0
              ? "border-transparent bg-[#0085FC] text-white"
              : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
          }`}
        >
          Todas
        </button>
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onToggle(cat)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedCategories.includes(cat)
                ? "border-transparent bg-[#0085FC] text-white"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-6 flex gap-1.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= step ? "bg-[#0085FC]" : "bg-[var(--border-subtle)]"
          }`}
        />
      ))}
    </div>
  );
}

export default function TorneoFormInline({
  clubId,
  onSuccess,
}: {
  clubId: string;
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<TournamentTypeKey>("americano");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [deadline, setDeadline] = useState("");
  const [price, setPrice] = useState(0);
  const [maxPairs, setMaxPairs] = useState(16);
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [selectedIncludes, setSelectedIncludes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [hasFinals, setHasFinals] = useState(true);
  const [matchFormat, setMatchFormat] = useState<"set" | "tiempo">("set");
  const [matchDuration, setMatchDuration] = useState(20);
  const [consolationBracket, setConsolationBracket] = useState(false);
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [numCourts, setNumCourts] = useState(2);
  const [foodIncluded, setFoodIncluded] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canStep2 = Boolean(name.trim() && startDate);
  const priceLabel =
    type === "pena" ? "Precio por jugador (ARS)" : "Precio por pareja (ARS)";
  const typeLabel =
    TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
  const effectiveDeadline = deadline || startDate;
  const effectiveEndDate =
    type === "eliminacion" && multiDay ? endDate || startDate : startDate;

  function toggleInclude(item: string) {
    setSelectedIncludes((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  }

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("club_id", clubId);
      fd.set("tournament_type", type);
      fd.set("name", name.trim());
      fd.set("start_date", startDate);
      fd.set("start_time", startTime);
      fd.set("end_date", effectiveEndDate);
      fd.set("registration_deadline", `${effectiveDeadline}T00:00`);
      fd.set("price_per_pair", String(price));
      fd.set("max_pairs", String(type === "pena" ? maxPlayers : maxPairs));
      fd.set("has_finals", String(hasFinals));
      fd.set("match_format", matchFormat);
      if (matchFormat === "tiempo")
        fd.set("match_duration_minutes", String(matchDuration));
      fd.set("consolation_bracket", String(consolationBracket));
      fd.set("multi_day", String(multiDay));
      if (type === "pena") {
        selectedIncludes.forEach((item) => fd.append("what_includes", item));
        fd.set("num_courts", String(numCourts));
        if (foodIncluded.trim()) fd.set("food_included", foodIncluded.trim());
      } else {
        selectedCategories.forEach((c) => fd.append("allowed_categories", c));
      }

      const result = await createTournamentAction(
        { ok: false, message: "" },
        fd,
      );
      if (result.ok) onSuccess?.();
      else setError(result.message);
    });
  }

  return (
    <div className={`${adminCard} space-y-5`}>
      <ProgressBar step={step} />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <p className="font-bold text-[var(--text-primary)]">
            ¿Qué tipo de torneo querés organizar?
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {TOURNAMENT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`${adminCard} ${adminPressable} flex cursor-pointer flex-col gap-2 text-left transition ${
                  type === opt.value
                    ? "border-[#0085FC]/30 bg-[#0085FC]/10 ring-2 ring-[#0085FC]"
                    : "hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{TYPE_EMOJI[opt.value]}</span>
                  {type === opt.value ? (
                    <span className="font-bold text-[#0085FC]">✓</span>
                  ) : null}
                </div>
                <p className="font-bold text-[var(--text-primary)]">
                  {opt.label}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {TYPE_DESCRIPTION[opt.value]}
                </p>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className={`w-full ${adminCTAPrimary}`}
          >
            Continuar →
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4 text-sm">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Nombre del torneo
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Fecha de inicio
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
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

          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Fecha límite de inscripción
            </span>
            <input
              type="date"
              value={effectiveDeadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {priceLabel}
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

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
            >
              ← Volver
            </button>
            <button
              type="button"
              disabled={!canStep2}
              onClick={() => setStep(3)}
              className={`flex-1 ${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Continuar →
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4 text-sm">
          {type === "pena" ? (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Máximo de jugadores
                </span>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                >
                  {PENA_MAX_PLAYERS_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} jugadores
                    </option>
                  ))}
                </select>
              </label>

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
                        checked={selectedIncludes.includes(opt)}
                        onChange={() => toggleInclude(opt)}
                      />
                      <span className="text-sm text-[var(--text-primary)]">
                        {opt}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

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

              <div>
                <label className={adminKicker}>Partidos</label>
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
                      max={30}
                      step={5}
                      value={matchDuration}
                      onChange={(e) => setMatchDuration(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                    />
                  </div>
                ) : null}
              </div>

              <div>
                <label className={adminKicker}>¿Incluye algo? (opcional)</label>
                <p className="mb-1 text-xs text-[var(--text-tertiary)]">
                  Ej: &quot;Pizza y bebida&quot;, &quot;Asado&quot;,
                  &quot;Empanadas&quot;
                </p>
                <input
                  type="text"
                  value={foodIncluded}
                  onChange={(e) => setFoodIncluded(e.target.value)}
                  placeholder="Describí qué incluye la peña..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                />
              </div>
            </>
          ) : type === "eliminacion" ? (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Máximo de parejas
                </span>
                <select
                  value={maxPairs}
                  onChange={(e) => setMaxPairs(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                >
                  {MAX_PAIRS_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} parejas
                    </option>
                  ))}
                </select>
              </label>

              <CategoryChips
                selectedCategories={selectedCategories}
                onToggle={toggleCategory}
                onClear={() => setSelectedCategories([])}
              />

              <div>
                <label className={adminKicker}>¿Copa de plata?</label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConsolationBracket(true)}
                    className={chip(consolationBracket)}
                  >
                    🥈 Sí — los eliminados en 1ra ronda juegan copa de plata
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
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Máximo de parejas
                </span>
                <select
                  value={maxPairs}
                  onChange={(e) => setMaxPairs(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                >
                  {MAX_PAIRS_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} parejas
                    </option>
                  ))}
                </select>
              </label>

              <CategoryChips
                selectedCategories={selectedCategories}
                onToggle={toggleCategory}
                onClear={() => setSelectedCategories([])}
              />

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
                      min={10}
                      max={60}
                      step={5}
                      value={matchDuration}
                      onChange={(e) => setMatchDuration(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                    />
                  </div>
                ) : null}
              </div>
            </>
          )}

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3 text-xs text-[var(--text-secondary)]">
            {typeLabel} · {name || "Sin nombre"} · {startDate || "Sin fecha"} ·
            ${price.toLocaleString("es-AR")} ·{" "}
            {type === "pena"
              ? `${maxPlayers} jugadores`
              : `${maxPairs} parejas`}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
            >
              ← Volver
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleSubmit}
              className={`flex-1 ${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {pending ? "Creando…" : "Crear torneo →"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
