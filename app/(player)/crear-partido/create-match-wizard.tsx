"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AppleToast } from "@/components/apple-toast";
import { createWizardMatchAction, type CreateWizardMatchState } from "./actions";

type ClubOption = {
  id: string;
  name: string;
  location: string;
};

type CourtOption = {
  id: string;
  clubId: string;
  name: string;
  price: number | null;
};

type ReservationRow = {
  courtId: string;
  dateKey: string;
  timeKey: string;
};

type AvailabilityCard = {
  clubId: string;
  clubName: string;
  location: string;
  courtId: string | null;
  courtName: string | null;
  price: number | null;
  available: boolean;
};

const initialState: CreateWizardMatchState = { success: false, message: "" };
const LOCATIONS = ["Rosario", "Funes", "Roldan"];

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextDates(total: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: total }, (_, idx) => {
    const date = new Date(start);
    date.setDate(start.getDate() + idx);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
    const label = date.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
    return { dateKey, label };
  });
}

function buildTimeSlots() {
  const slots: string[] = [];
  let totalMinutes = 8 * 60;
  const lastMinutes = 22 * 60 + 30;
  while (totalMinutes <= lastMinutes) {
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
    totalMinutes += 90;
  }
  return slots;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creando partido..." : "Confirmar y Crear Partido"}
    </button>
  );
}

export default function CreateMatchWizard({
  clubs,
  courts,
  reservations,
}: {
  clubs: ClubOption[];
  courts: CourtOption[];
  reservations: ReservationRow[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(createWizardMatchAction, initialState);
  const [step, setStep] = useState(1);
  const [locationName, setLocationName] = useState("Rosario");
  const [scheduledDate, setScheduledDate] = useState(todayIsoDate());
  const [scheduledTime, setScheduledTime] = useState("08:00");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [matchType, setMatchType] = useState<"amistoso" | "competitivo">("amistoso");
  const [visibility, setVisibility] = useState<"publico" | "privado">("publico");
  const dateItems = useMemo(() => nextDates(10), []);
  const timeSlots = useMemo(() => buildTimeSlots(), []);

  const availabilityCards = useMemo<AvailabilityCard[]>(() => {
    const reservationSet = new Set(
      reservations
        .filter((item) => item.dateKey === scheduledDate && item.timeKey === scheduledTime)
        .map((item) => item.courtId)
    );

    return clubs
      .filter((club) => club.location === locationName)
      .map((club) => {
        const clubCourts = courts.filter((court) => court.clubId === club.id);
        const freeCourt = clubCourts.find((court) => !reservationSet.has(court.id));
        const fallbackCourt = clubCourts[0];
        return {
          clubId: club.id,
          clubName: club.name,
          location: club.location,
          courtId: freeCourt?.id ?? null,
          courtName: freeCourt?.name ?? fallbackCourt?.name ?? null,
          price: freeCourt?.price ?? fallbackCourt?.price ?? null,
          available: Boolean(freeCourt),
        };
      });
  }, [clubs, courts, locationName, reservations, scheduledDate, scheduledTime]);

  const selectedAvailability = availabilityCards.find((item) => item.clubId === selectedClubId) ?? null;
  const selectedPrice = selectedAvailability?.price ?? null;

  useEffect(() => {
    if (!state.success || !state.matchId) return;
    const timeout = window.setTimeout(() => router.push(`/matches/${state.matchId}`), 900);
    return () => window.clearTimeout(timeout);
  }, [router, state.matchId, state.success]);

  const canContinueStep1 = Boolean(selectedClubId && selectedCourtId && scheduledDate && scheduledTime);
  const canContinueStep2 = Boolean(matchType && visibility);

  return (
    <>
      <form action={action} className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <input type="hidden" name="club_id" value={selectedClubId} />
        <input type="hidden" name="court_id" value={selectedCourtId} />
        <input type="hidden" name="location_name" value={locationName} />
        <input type="hidden" name="scheduled_date" value={scheduledDate} />
        <input type="hidden" name="scheduled_time" value={scheduledTime} />
        <input type="hidden" name="match_type" value={matchType} />
        <input type="hidden" name="visibility" value={visibility} />

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          {[1, 2, 3].map((item) => (
            <span
              key={item}
              className={`rounded-full px-3 py-1 ${step === item ? "bg-sky-100 text-sky-700" : "bg-slate-100"}`}
            >
              Paso {item}
            </span>
          ))}
        </div>

        {step === 1 ? (
          <section className="space-y-5">
            <div className="space-y-2">
              <p className="text-lg font-semibold tracking-tight text-slate-900">Filtros y disponibilidad</p>
              <p className="text-sm text-slate-500">Elegí ubicación, fecha y horario para ver clubes disponibles.</p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Ubicación</span>
              <select
                value={locationName}
                onChange={(event) => {
                  setLocationName(event.target.value);
                  setSelectedClubId("");
                  setSelectedCourtId("");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none ring-sky-200 transition focus:ring-2"
              >
                {LOCATIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Fecha</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dateItems.map((item) => (
                  <button
                    key={item.dateKey}
                    type="button"
                    onClick={() => {
                      setScheduledDate(item.dateKey);
                      setSelectedClubId("");
                      setSelectedCourtId("");
                    }}
                    className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-medium ${
                      scheduledDate === item.dateKey
                        ? "border-sky-300 bg-sky-50 text-sky-700 ring-2 ring-sky-200"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Horario</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setScheduledTime(slot);
                      setSelectedClubId("");
                      setSelectedCourtId("");
                    }}
                    className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-medium ${
                      scheduledTime === slot
                        ? "border-slate-900 bg-slate-900 text-white ring-2 ring-slate-300"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {slot}hs
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">Clubes disponibles</p>
              {availabilityCards.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No hay clubes en esta ubicación.
                </p>
              ) : (
                availabilityCards.map((item) => (
                  <button
                    key={item.clubId}
                    type="button"
                    disabled={!item.available}
                    onClick={() => {
                      if (!item.available || !item.courtId) return;
                      setSelectedClubId(item.clubId);
                      setSelectedCourtId(item.courtId);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedClubId === item.clubId
                        ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200"
                        : "border-slate-200 bg-white"
                    } ${item.available ? "" : "cursor-not-allowed opacity-70"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.clubName}</p>
                        <p className="text-xs text-slate-500">
                          {item.location} · {item.courtName ?? "Cancha"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.available
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {item.available ? "Cancha Disponible" : "Cancha Reservada"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-5">
            <div className="space-y-2">
              <p className="text-lg font-semibold tracking-tight text-slate-900">Configuración del partido</p>
              <p className="text-sm text-slate-500">Definí modalidad y privacidad del encuentro.</p>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setMatchType("amistoso")}
                className={`rounded-2xl border p-4 text-left ${
                  matchType === "amistoso"
                    ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">Amistoso</p>
                <p className="text-xs text-slate-500">Juego recreativo, no afecta el ranking.</p>
              </button>
              <button
                type="button"
                onClick={() => setMatchType("competitivo")}
                className={`rounded-2xl border p-4 text-left ${
                  matchType === "competitivo"
                    ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">Competitivo</p>
                <p className="text-xs text-slate-500">
                  Suma puntos para tu categoría y evolución de nivel.
                </p>
              </button>
            </div>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Privacidad</p>
                <p className="text-xs text-slate-500">
                  {visibility === "publico"
                    ? "Público: cualquier jugador puede unirse."
                    : "Privado: solo por invitación o aprobación."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVisibility((prev) => (prev === "publico" ? "privado" : "publico"))}
                className={`relative h-7 w-12 rounded-full transition ${
                  visibility === "publico" ? "bg-sky-500" : "bg-slate-300"
                }`}
                aria-label="Cambiar privacidad del partido"
                aria-pressed={visibility === "publico"}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                    visibility === "publico" ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </label>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <p className="text-lg font-semibold tracking-tight text-slate-900">Resumen y confirmación</p>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Club:</span>{" "}
                {selectedAvailability?.clubName ?? "Sin seleccionar"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Horario:</span> {scheduledDate} · {scheduledTime}hs
              </p>
              <p>
                <span className="font-semibold text-slate-900">Tipo de partido:</span>{" "}
                {matchType === "competitivo" ? "Competitivo" : "Amistoso"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Precio:</span>{" "}
                {selectedPrice != null ? `$${selectedPrice}` : "A confirmar"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-4 animate-pulse rounded bg-slate-100" />
                <div className="h-4 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </section>
        ) : null}

        <div className="flex gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Volver
            </button>
          ) : null}

          {step < 3 ? (
            <button
              type="button"
              disabled={(step === 1 && !canContinueStep1) || (step === 2 && !canContinueStep2)}
              onClick={() => setStep((prev) => Math.min(3, prev + 1))}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
            </button>
          ) : (
            <SubmitButton />
          )}
        </div>
      </form>
      <AppleToast message={state.message || null} />
    </>
  );
}
