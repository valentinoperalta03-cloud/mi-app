"use client";

import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState, useTransition } from "react";
import { adminButtonSecondary } from "@/components/admin/admin-premium";
import type { AvailabilitySlot } from "../../(club)/[slug]/actions";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { crearPartidoDesdeAdmin, getAdminClubAvailability, type GuestPlayerInput } from "./actions";
import type { ReservasCourtOption } from "./reservas-tabs";

const CATEGORY_OPTIONS = ["8va", "7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"];
const GENDER_OPTIONS: { value: "masculino" | "femenino" | "mixto"; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "femenino", label: "Femenino" },
  { value: "mixto", label: "Mixto" },
];

type DayChip = { ymd: string; label: string };

function buildDayChips(): DayChip[] {
  const todayYmd = getTodayYmdInArgentina();
  const todayDate = new Date(`${todayYmd}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(todayDate, i);
    const ymd = format(d, "yyyy-MM-dd");
    let label: string;
    if (i === 0) label = "Hoy";
    else if (i === 1) label = "Mañana";
    else {
      const weekday = format(d, "EEE", { locale: es });
      label = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1, 3)} ${format(d, "d")}`;
    }
    return { ymd, label };
  });
}

export default function OpenMatchModal({
  clubId,
  clubName,
  courts,
  onClose,
}: {
  clubId: string;
  clubName: string;
  courts: ReservasCourtOption[];
  onClose: () => void;
}) {
  const dayChips = useMemo(() => buildDayChips(), []);
  const courtsById = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState(dayChips[0].ymd);
  const [availability, setAvailability] = useState<{ slots: AvailabilitySlot[]; prices: Record<string, number> }>({
    slots: [],
    prices: {},
  });
  const [isLoadingSlots, startLoadingSlots] = useTransition();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [genderCategory, setGenderCategory] = useState<"masculino" | "femenino" | "mixto">("mixto");
  const [categoryRange, setCategoryRange] = useState<string[]>([]);
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayerInput[]>([]);
  const [isPublishing, startPublishing] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startLoadingSlots(async () => {
      const result = await getAdminClubAvailability(clubId, selectedDate);
      setAvailability(result);
    });
  }, [clubId, selectedDate]);

  function handleSelectDate(ymd: string) {
    setSelectedTime(null);
    setSelectedDate(ymd);
  }

  function toggleCategory(cat: string) {
    setCategoryRange((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  function addGuestPlayer() {
    if (guestPlayers.length >= 3) return;
    const team1Count = guestPlayers.filter((g) => g.team === 1).length;
    const team = team1Count < 2 ? 1 : 2;
    setGuestPlayers((prev) => [...prev, { name: "", team }]);
  }

  function updateGuestName(idx: number, name: string) {
    setGuestPlayers((prev) => prev.map((g, i) => (i === idx ? { ...g, name } : g)));
  }

  function updateGuestTeam(idx: number, team: 1 | 2) {
    setGuestPlayers((prev) => prev.map((g, i) => (i === idx ? { ...g, team } : g)));
  }

  function removeGuestPlayer(idx: number) {
    setGuestPlayers((prev) => prev.filter((_, i) => i !== idx));
  }

  const availableCourtIds = selectedTime
    ? availability.slots.find((s) => s.time === selectedTime)?.courtIds ?? []
    : [];
  const selectedCourt = selectedCourtId ? courtsById.get(selectedCourtId) : null;

  function handlePublish() {
    if (!selectedCourtId || !selectedTime) return;
    setError(null);
    startPublishing(async () => {
      const result = await crearPartidoDesdeAdmin({
        courtId: selectedCourtId,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        genderCategory,
        categoryRange,
        guestPlayers,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto" style={{ borderRadius: 16, background: "var(--bg-card)" }}>
        <div
          style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)", borderRadius: "16px 16px 0 0", padding: "20px 24px" }}
        >
          <h2 className="font-admin-display text-lg font-bold text-white">Abrir partido</h2>
          <p className="mt-1 text-sm text-white/80">Paso {step} de 3</p>
        </div>

        <div style={{ padding: 24 }} className="space-y-5">
          {step === 1 ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Cuándo</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dayChips.map((d) => {
                  const active = d.ymd === selectedDate;
                  return (
                    <button
                      key={d.ymd}
                      type="button"
                      onClick={() => handleSelectDate(d.ymd)}
                      className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        active
                          ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              {isLoadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[52px] animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
                  ))}
                </div>
              ) : availability.slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
                  Sin turnos disponibles ese día.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availability.slots.map((slot) => {
                    const active = slot.time === selectedTime;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setSelectedTime(slot.time)}
                        className={`rounded-xl border px-3 py-3 text-center text-sm font-bold transition-colors ${
                          active
                            ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]"
                            : "border-[var(--border-subtle)] text-[var(--text-primary)]"
                        }`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className={`flex-1 ${adminButtonSecondary}`}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedTime}
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)" }}
                >
                  Continuar
                </button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                ← Cambiar horario
              </button>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Cancha</p>
              <div className="flex flex-col gap-2">
                {availableCourtIds.map((courtId) => {
                  const court = courtsById.get(courtId);
                  if (!court) return null;
                  const active = courtId === selectedCourtId;
                  return (
                    <button
                      key={courtId}
                      type="button"
                      onClick={() => setSelectedCourtId(courtId)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? "border-[#0085FC] bg-[#0085FC]/5"
                          : "border-[var(--border-subtle)] bg-transparent"
                      }`}
                    >
                      <p className="text-sm font-bold text-[var(--text-primary)]">{court.name}</p>
                    </button>
                  );
                })}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Género</p>
                <div className="grid grid-cols-3 gap-2">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGenderCategory(opt.value)}
                      className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors ${
                        genderCategory === opt.value
                          ? "bg-[#0085FC] text-white"
                          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  Categorías permitidas (opcional)
                </p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((cat) => {
                    const active = categoryRange.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]"
                            : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className={`flex-1 ${adminButtonSecondary}`}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedCourtId}
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)" }}
                >
                  Continuar
                </button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                ← Cambiar cancha
              </button>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 p-3 text-sm text-[var(--text-secondary)]">
                <p className="font-bold text-[var(--text-primary)]">{clubName}</p>
                <p className="mt-0.5">
                  {selectedCourt?.name ?? "Cancha"} · {selectedDate} · {selectedTime}hs
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  ¿Ya tenés jugadores para este partido?
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Podés agregar hasta 3 jugadores encontrados por el club. El 4to lugar queda libre para que se
                  anote alguien desde la app.
                </p>
              </div>

              <div className="space-y-3">
                {guestPlayers.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] p-2.5">
                    <input
                      value={g.name}
                      onChange={(e) => updateGuestName(idx, e.target.value)}
                      placeholder="Nombre (opcional)"
                      className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm"
                    />
                    <div className="flex gap-1">
                      {([1, 2] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => updateGuestTeam(idx, t)}
                          className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                            g.team === t ? "bg-[#0085FC] text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                          }`}
                        >
                          E{t}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGuestPlayer(idx)}
                      aria-label="Quitar"
                      className="text-[var(--text-tertiary)] hover:text-rose-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {guestPlayers.length < 3 ? (
                  <button
                    type="button"
                    onClick={addGuestPlayer}
                    className={`w-full ${adminButtonSecondary}`}
                  >
                    + Agregar jugador del club
                  </button>
                ) : null}
              </div>

              {error ? <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className={`flex-1 ${adminButtonSecondary}`}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={handlePublish}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)" }}
                >
                  {isPublishing ? "Publicando…" : "Publicar partido"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
