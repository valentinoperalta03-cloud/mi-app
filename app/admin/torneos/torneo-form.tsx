"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  adminCard,
  adminCTAPrimary,
  adminKicker,
  adminPressable,
} from "@/components/admin/admin-premium";
import { PROFILE_CATEGORIES } from "@/lib/profile-display";
import { getCourtAvailabilityForDate } from "@/lib/tournament-availability";
import {
  MAX_PAIRS_OPTIONS,
  PENA_MAX_PLAYERS_OPTIONS,
  TOURNAMENT_TYPE_OPTIONS,
  type TournamentTypeKey,
} from "@/lib/tournament-constants";
import { AvailabilityGrid } from "./availability-grid";
import { createTournamentAction } from "./actions";

export const CATEGORY_OPTIONS = PROFILE_CATEGORIES.slice().reverse();

type Court = { id: string; name: string };

type Availability = {
  slots: string[];
  occupiedByCourtAndSlot: Record<string, Record<string, string>>;
};

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

function ProgressBar({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="mb-6 flex gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
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

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]";

export default function TorneoFormInline({
  clubId,
  courts,
  onSuccess,
}: {
  clubId: string;
  courts: Court[];
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [type, setType] = useState<TournamentTypeKey>("americano");

  // Paso 2 — fechas + disponibilidad
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [multiDay, setMultiDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [newExtraDate, setNewExtraDate] = useState("");
  const [availabilityByDate, setAvailabilityByDate] = useState<
    Record<string, Availability>
  >({});
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());
  const [selectedSlotsByDate, setSelectedSlotsByDate] = useState<
    Record<string, Record<string, boolean>>
  >({});

  // Paso 3 — modalidad
  const [maxPairs, setMaxPairs] = useState(16);
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [guaranteedMatches, setGuaranteedMatches] = useState(0);
  const [matchFormat, setMatchFormat] = useState<
    "set" | "tres_sets" | "tiempo"
  >("set");
  const [matchDuration, setMatchDuration] = useState(20);
  const [tournamentNotes, setTournamentNotes] = useState("");
  const [hasFinals, setHasFinals] = useState(true);
  const [consolationBracket, setConsolationBracket] = useState(false);
  const [matchesPerDay, setMatchesPerDay] = useState(0);
  const [quarterfinalsDate, setQuarterfinalsDate] = useState("");
  const [semifinalsDate, setSemifinalsDate] = useState("");
  const [finalsDate, setFinalsDate] = useState("");
  const [numCourts, setNumCourts] = useState(2);
  const [foodIncluded, setFoodIncluded] = useState("");

  // Paso 4 — métodos de pago
  const [acceptsMp, setAcceptsMp] = useState(true);
  const [acceptsCash, setAcceptsCash] = useState(false);
  const [acceptsTransfer, setAcceptsTransfer] = useState(false);
  const [transferAlias, setTransferAlias] = useState("");
  // Seña por MP: reusa requires_deposit/deposit_type/deposit_value (ya
  // implementado en el checkout del jugador vía calculateDepositAmount), no
  // se agrega una columna nueva para no duplicar esa lógica de cobro.
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState(50);

  // Paso 5 — premios + contacto
  const [hasPrizes, setHasPrizes] = useState(false);
  const [prizes, setPrizes] = useState<string[]>(["", ""]);
  const [contactPhone, setContactPhone] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const priceLabel =
    type === "pena" ? "Precio por jugador (ARS)" : "Precio por pareja (ARS)";
  const effectiveDeadline = deadline || startDate;

  const selectedDates =
    type === "eliminacion" && multiDay
      ? [startDate, ...extraDates].filter(Boolean)
      : startDate
        ? [startDate]
        : [];
  const effectiveEndDate =
    selectedDates.length > 0
      ? selectedDates[selectedDates.length - 1]
      : startDate;

  const totalSelectedSlots = Object.values(selectedSlotsByDate).flatMap((m) =>
    Object.values(m).filter(Boolean),
  ).length;
  const canStep2 = Boolean(name.trim() && startDate && totalSelectedSlots > 0);
  const canStep4 = acceptsMp || acceptsCash || acceptsTransfer;

  function handleRequiresDepositChange(value: boolean) {
    setRequiresDeposit(value);
    if (value) {
      setAcceptsCash(false);
      setAcceptsTransfer(false);
    }
  }

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  async function loadAvailability(date: string) {
    if (!date || !courts.length) return;
    setLoadingDates((prev) => new Set(prev).add(date));
    const courtIds = courts.map((c) => c.id);
    const avail = await getCourtAvailabilityForDate(clubId, courtIds, date);
    setAvailabilityByDate((prev) => ({ ...prev, [date]: avail }));
    setLoadingDates((prev) => {
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
  }

  function handleStartDateChange(date: string) {
    setStartDate(date);
    if (date) void loadAvailability(date);
  }

  function addExtraDate() {
    if (
      !newExtraDate ||
      newExtraDate === startDate ||
      extraDates.includes(newExtraDate)
    )
      return;
    setExtraDates((prev) => [...prev, newExtraDate]);
    void loadAvailability(newExtraDate);
    setNewExtraDate("");
  }

  function removeExtraDate(date: string) {
    setExtraDates((prev) => prev.filter((d) => d !== date));
    setSelectedSlotsByDate((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }

  function toggleSlot(date: string, courtId: string, time: string) {
    const key = `${courtId}:${time}`;
    setSelectedSlotsByDate((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] ?? {}),
        [key]: !(prev[date]?.[key] ?? false),
      },
    }));
  }

  function renderDateAvailability(date: string, removable: boolean) {
    if (!date) return null;
    const avail = availabilityByDate[date];
    return (
      <div key={date} className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold capitalize text-[var(--text-primary)]">
            {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          {removable ? (
            <button
              type="button"
              onClick={() => removeExtraDate(date)}
              className="text-xs font-bold text-rose-500"
            >
              ✕ Quitar
            </button>
          ) : null}
        </div>
        {loadingDates.has(date) ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0085FC] border-t-transparent" />
            Cargando disponibilidad...
          </div>
        ) : avail ? (
          <AvailabilityGrid
            courts={courts}
            slots={avail.slots}
            occupiedByCourtAndSlot={avail.occupiedByCourtAndSlot}
            multiSelect
            selectedSlots={selectedSlotsByDate[date] ?? {}}
            onToggle={(courtId, time) => toggleSlot(date, courtId, time)}
          />
        ) : null}
      </div>
    );
  }

  function renderMatchFormatPicker(
    label: string,
    durationMin: number,
    durationMax: number,
  ) {
    return (
      <div>
        <label className={adminKicker}>{label}</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMatchFormat("set")}
            className={chip(matchFormat === "set")}
          >
            🎾 A un set
          </button>
          <button
            type="button"
            onClick={() => setMatchFormat("tres_sets")}
            className={chip(matchFormat === "tres_sets")}
          >
            🏆 Al mejor de 3 sets
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
              min={durationMin}
              max={durationMax}
              step={5}
              value={matchDuration}
              onChange={(e) => setMatchDuration(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        ) : null}
      </div>
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
      fd.set("multi_day", String(type === "eliminacion" && multiDay));
      if (guaranteedMatches > 0)
        fd.set("guaranteed_matches", String(guaranteedMatches));

      selectedCategories.forEach((c) => fd.append("allowed_categories", c));
      if (type === "pena") {
        fd.set("num_courts", String(numCourts));
        if (foodIncluded.trim()) fd.set("food_included", foodIncluded.trim());
      }

      if (type === "americano" && tournamentNotes.trim()) {
        fd.set("tournament_notes", tournamentNotes.trim());
      }
      if (type === "eliminacion" && multiDay) {
        if (matchesPerDay > 0) fd.set("matches_per_day", String(matchesPerDay));
        if (quarterfinalsDate) fd.set("quarterfinals_date", quarterfinalsDate);
        if (semifinalsDate) fd.set("semifinals_date", semifinalsDate);
        if (finalsDate) fd.set("finals_date", finalsDate);
      }

      fd.set("accepts_mp", String(acceptsMp));
      fd.set("accepts_cash", String(acceptsCash));
      fd.set("accepts_transfer", String(acceptsTransfer));
      if (acceptsTransfer && transferAlias.trim())
        fd.set("transfer_alias", transferAlias.trim());
      if (acceptsMp && requiresDeposit) {
        fd.set("requires_deposit", "true");
        fd.set("deposit_type", "percentage");
        fd.set("deposit_value", String(depositPercentage));
      }

      if (contactPhone.trim()) fd.set("contact_phone", `+54${contactPhone}`);
      if (hasPrizes && prizes.some((p) => p.trim())) {
        fd.set(
          "prizes",
          JSON.stringify(
            prizes
              .map((p, i) => ({ position: i + 1, description: p.trim() }))
              .filter((p) => p.description),
          ),
        );
      }

      const slots = Object.entries(selectedSlotsByDate).flatMap(
        ([date, slotMap]) =>
          Object.entries(slotMap)
            .filter(([, selected]) => selected)
            .map(([key]) => {
              const [courtId, time] = key.split(":");
              return { date, courtId, time };
            }),
      );
      if (slots.length > 0)
        fd.set("tournament_court_blocks", JSON.stringify(slots));

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
              className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
            />
          </label>

          {type === "eliminacion" ? (
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
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Fecha del torneo
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              required
              className={inputClass}
            />
          </label>

          <div className="rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/[0.04] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              📅 Los horarios del torneo son libres
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
              Los torneos se pueden organizar en el horario que el administrador
              decida, sin depender del horario de apertura del club. El único
              impedimento para reservar un horario es que haya otra actividad
              programada en esa cancha: una reserva, turno fijo, clase,
              entrenamiento u otro torneo.
            </p>
          </div>

          <div className="space-y-4">
            {renderDateAvailability(startDate, false)}
            {type === "eliminacion" && multiDay
              ? extraDates.map((d) => renderDateAvailability(d, true))
              : null}
          </div>

          {type === "eliminacion" && multiDay ? (
            <div className="flex items-end gap-2">
              <label className="block flex-1">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Agregar otro día
                </span>
                <input
                  type="date"
                  value={newExtraDate}
                  min={startDate}
                  onChange={(e) => setNewExtraDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={addExtraDate}
                className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-semibold text-[#0085FC]"
              >
                + Agregar día
              </button>
            </div>
          ) : null}

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
              <div>
                <label className={adminKicker}>Cantidad de jugadores</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PENA_MAX_PLAYERS_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxPlayers(n)}
                      className={chip(maxPlayers === n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <CategoryChips
                selectedCategories={selectedCategories}
                onToggle={toggleCategory}
                onClear={() => setSelectedCategories([])}
              />

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

              {renderMatchFormatPicker("Partidos", 5, 30)}

              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Partidos garantizados
                </span>
                <input
                  type="number"
                  min={0}
                  value={guaranteedMatches}
                  onChange={(e) =>
                    setGuaranteedMatches(Number(e.target.value) || 0)
                  }
                  className={inputClass}
                />
              </label>

              <div>
                <label className={adminKicker}>¿Incluye algo?</label>
                <p className="mb-1 text-xs text-[var(--text-tertiary)]">
                  Ej: &quot;Pizza y bebida&quot;, &quot;asado con entrada
                  libre&quot;...
                </p>
                <input
                  type="text"
                  value={foodIncluded}
                  onChange={(e) => setFoodIncluded(e.target.value)}
                  placeholder="Ej: Pizza y bebida, asado con entrada libre..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                />
              </div>
            </>
          ) : type === "eliminacion" ? (
            <>
              <div>
                <label className={adminKicker}>Cantidad de parejas</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MAX_PAIRS_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxPairs(n)}
                      className={chip(maxPairs === n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <CategoryChips
                selectedCategories={selectedCategories}
                onToggle={toggleCategory}
                onClear={() => setSelectedCategories([])}
              />

              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Partidos garantizados
                </span>
                <input
                  type="number"
                  min={0}
                  value={guaranteedMatches}
                  onChange={(e) =>
                    setGuaranteedMatches(Number(e.target.value) || 0)
                  }
                  className={inputClass}
                />
              </label>

              {renderMatchFormatPicker("Formato de partidos", 10, 60)}

              <div>
                <label className={adminKicker}>¿Copa de plata?</label>
                <p className="mb-1 text-xs text-[var(--text-tertiary)]">
                  Copa de Oro: el campeón. Copa de Plata: los eliminados en 1ra
                  ronda juegan su propio bracket.
                </p>
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

              {multiDay ? (
                <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    Cronograma multi-día
                  </p>
                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      Partidos por día
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={matchesPerDay}
                      onChange={(e) =>
                        setMatchesPerDay(Number(e.target.value) || 0)
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      Fecha cuartos de final
                    </span>
                    <input
                      type="date"
                      value={quarterfinalsDate}
                      onChange={(e) => setQuarterfinalsDate(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      Fecha semifinales
                    </span>
                    <input
                      type="date"
                      value={semifinalsDate}
                      onChange={(e) => setSemifinalsDate(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      Fecha final
                    </span>
                    <input
                      type="date"
                      value={finalsDate}
                      onChange={(e) => setFinalsDate(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Cantidad de parejas
                </span>
                <input
                  type="number"
                  min={4}
                  max={64}
                  value={maxPairs}
                  onChange={(e) => setMaxPairs(Number(e.target.value) || 0)}
                  placeholder="Ej: 12"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Para eliminación directa se recomienda potencia de 2 (8, 16,
                  32, 64)
                </p>
              </label>

              <CategoryChips
                selectedCategories={selectedCategories}
                onToggle={toggleCategory}
                onClear={() => setSelectedCategories([])}
              />

              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Partidos garantizados
                </span>
                <input
                  type="number"
                  min={0}
                  value={guaranteedMatches}
                  onChange={(e) =>
                    setGuaranteedMatches(Number(e.target.value) || 0)
                  }
                  className={inputClass}
                />
              </label>

              {renderMatchFormatPicker("Formato de partidos", 10, 60)}

              <div>
                <label className={adminKicker}>¿Cómo se organiza?</label>
                <textarea
                  value={tournamentNotes}
                  onChange={(e) => setTournamentNotes(e.target.value)}
                  rows={3}
                  placeholder="Ej: Dos grupos de 8 parejas, pasan las 2 mejores de cada grupo a semifinales"
                  className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
                />
              </div>

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
            </>
          )}

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
              onClick={() => setStep(4)}
              className={`flex-1 ${adminCTAPrimary}`}
            >
              Continuar →
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4 text-sm">
          <div className="space-y-3">
            <label className={adminKicker}>Métodos de pago aceptados</label>
            <p className="text-xs text-[var(--text-tertiary)]">
              El jugador va a ver estas opciones al inscribirse.
            </p>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={acceptsMp}
                onChange={(e) => setAcceptsMp(e.target.checked)}
              />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                💳 Mercado Pago (online)
              </span>
            </label>

            <label
              className={`flex items-center gap-3 ${requiresDeposit ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={acceptsCash}
                disabled={requiresDeposit}
                onChange={(e) => setAcceptsCash(e.target.checked)}
              />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                💵 Efectivo (en el club)
              </span>
            </label>

            <label
              className={`flex items-center gap-3 ${requiresDeposit ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={acceptsTransfer}
                disabled={requiresDeposit}
                onChange={(e) => setAcceptsTransfer(e.target.checked)}
              />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                🏦 Transferencia bancaria
              </span>
            </label>

            {acceptsTransfer ? (
              <div className="ml-7 space-y-2">
                <label className={adminKicker}>
                  Alias o CBU para transferencias
                </label>
                <input
                  type="text"
                  value={transferAlias}
                  onChange={(e) => setTransferAlias(e.target.value)}
                  placeholder="Ej: catedral.padel o 0000003100097753669989"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
            ) : null}
          </div>

          {acceptsMp ? (
            <div className="space-y-2">
              <label className={adminKicker}>¿Requiere seña por MP?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRequiresDepositChange(false)}
                  className={chip(!requiresDeposit)}
                >
                  No — pago completo
                </button>
                <button
                  type="button"
                  onClick={() => handleRequiresDepositChange(true)}
                  className={chip(requiresDeposit)}
                >
                  Sí — seña parcial
                </button>
              </div>
              {requiresDeposit ? (
                <div className="rounded-2xl border border-amber-300/30 bg-amber-400/[0.06] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    ⚠️ Con seña obligatoria solo se acepta Mercado Pago
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Para aceptar efectivo o transferencia, desactivá la seña parcial.
                  </p>
                </div>
              ) : null}
              {requiresDeposit ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={90}
                    step={5}
                    value={depositPercentage}
                    onChange={(e) =>
                      setDepositPercentage(Number(e.target.value) || 0)
                    }
                    className="w-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">
                    % del total como seña
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {!canStep4 ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Elegí al menos un método de pago.
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
            >
              ← Volver
            </button>
            <button
              type="button"
              disabled={!canStep4}
              onClick={() => setStep(5)}
              className={`flex-1 ${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Continuar →
            </button>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4 text-sm">
          <div>
            <label className={adminKicker}>
              Teléfono de contacto para consultas
            </label>
            <p className="mb-1 text-xs text-[var(--text-tertiary)]">
              Los jugadores van a poder escribirte por WhatsApp con este número.
            </p>
            <div className="flex gap-2">
              <span className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-secondary)]">
                +54
              </span>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) =>
                  setContactPhone(e.target.value.replace(/\D/g, ""))
                }
                placeholder="91122334455"
                className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className={adminKicker}>¿Hay premios?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHasPrizes(true)}
                className={chip(hasPrizes)}
              >
                🏆 Sí, hay premios
              </button>
              <button
                type="button"
                onClick={() => setHasPrizes(false)}
                className={chip(!hasPrizes)}
              >
                Sin premios
              </button>
            </div>
            {hasPrizes ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--text-tertiary)]">
                  Describí el premio para cada puesto. Podés agregar los que
                  quieras.
                </p>
                {prizes.map((prize, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-sm font-semibold text-[var(--text-secondary)]">
                      {i === 0
                        ? "🥇 1er"
                        : i === 1
                          ? "🥈 2do"
                          : i === 2
                            ? "🥉 3er"
                            : `🏅 ${i + 1}to`}
                    </span>
                    <input
                      value={prize}
                      onChange={(e) => {
                        const next = [...prizes];
                        next[i] = e.target.value;
                        setPrizes(next);
                      }}
                      placeholder="Ej: Copa + $50.000"
                      className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    {prizes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPrizes(prizes.filter((_, j) => j !== i))
                        }
                        className="text-sm font-bold text-rose-500"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setPrizes([...prizes, ""])}
                  className="text-sm font-semibold text-[#0085FC] hover:underline"
                >
                  + Agregar puesto
                </button>
              </div>
            ) : null}
          </div>

          <div
            className={`${adminCard} space-y-3 border-[#0085FC]/20 bg-[#0085FC]/[0.03]`}
          >
            <p className={adminKicker}>Resumen del torneo</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {name || "Sin nombre"}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Tipo</p>
                <p className="font-semibold text-[var(--text-primary)]">
                  {type === "americano"
                    ? "🏆 Americano"
                    : type === "eliminacion"
                      ? "⚡ Eliminación"
                      : "🎉 Peña"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Fecha</p>
                <p className="font-semibold text-[var(--text-primary)]">
                  {selectedDates[0]
                    ? format(parseISO(selectedDates[0]), "d MMM yyyy", {
                        locale: es,
                      })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Precio</p>
                <p className="font-semibold text-[var(--text-primary)]">
                  ${price.toLocaleString("es-AR")}{" "}
                  {type === "pena" ? "por jugador" : "por pareja"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Canchas bloqueadas
                </p>
                <p className="font-semibold text-[var(--text-primary)]">
                  {totalSelectedSlots} slots
                </p>
              </div>
            </div>
            {selectedCategories.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedCategories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full bg-[#CCFF00] px-2 py-0.5 text-[11px] font-black text-[#0A1628]"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-[var(--text-tertiary)]">
                Todas las categorías
              </span>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(4)}
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
