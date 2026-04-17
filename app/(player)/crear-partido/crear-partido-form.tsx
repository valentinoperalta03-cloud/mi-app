"use client";

import { addDays, format, getDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { buildSlotsForDay, type GeneratedSlot, type ScheduleInput } from "@/lib/court-slots";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/client";
import { crearPartido } from "./actions";

function fmtAr(numero: number) {
  return new Intl.NumberFormat("es-AR").format(numero);
}

export type GenderCategory = "masculino" | "femenino" | "mixto";

export type ClubOption = {
  id: string;
  name: string;
  location: string;
};

export type CourtOption = {
  id: string;
  clubId: string;
  name: string;
  price: number;
};

type MatchRow = {
  scheduled_time: string | null;
  duration_minutes: number | null;
};

function clockToMinutes(clock: string): number {
  const t = clock.trim().slice(0, 5);
  const [h, m] = t.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function overlapsSlot(slotStartMin: number, slotDur: number, otherStartMin: number, otherDur: number): boolean {
  const slotEnd = slotStartMin + slotDur;
  const otherEnd = otherStartMin + otherDur;
  return slotStartMin < otherEnd && otherStartMin < slotEnd;
}

export default function CrearPartidoForm({
  clubs,
  courts,
  defaultGender,
}: {
  clubs: ClubOption[];
  courts: CourtOption[];
  defaultGender: GenderCategory;
}) {
  const [selectedClubId, setSelectedClubId] = useState<string>(clubs[0]?.id ?? "");
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null);
  const [slots, setSlots] = useState<GeneratedSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<"amistoso" | "competitivo">("amistoso");
  const [visibility, setVisibility] = useState<"publico" | "privado">("publico");
  const [genderCategory, setGenderCategory] = useState<GenderCategory>(defaultGender);
  const [levelRestricted, setLevelRestricted] = useState(false);
  const [isSubmitting, startSubmit] = useTransition();

  const dates = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(start, i);
      const dayLabel = format(d, "EEE", { locale: es });
      return {
        key: format(d, "yyyy-MM-dd"),
        top: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1, 3),
        bottom: format(d, "d", { locale: es }),
      };
    });
  }, []);

  const availableCourts = useMemo(
    () => courts.filter((court) => court.clubId === selectedClubId),
    [courts, selectedClubId]
  );

  useEffect(() => {
    if (!selectedClubId) return;
    const firstCourt = courts.find((court) => court.clubId === selectedClubId);
    setSelectedCourtId(firstCourt?.id ?? "");
    setSelectedSlot(null);
    setSlots([]);
  }, [courts, selectedClubId]);

  const loadSlots = useCallback(async () => {
    if (!selectedCourtId || !selectedDate) return;
    setLoadingSlots(true);
    setError(null);
    setSelectedSlot(null);
    try {
      const supabase = createClient();
      const dayDate = parseISO(`${selectedDate}T12:00:00`);
      const dayOfWeek = getDay(dayDate);

      const [{ data: scheduleRows, error: scheduleError }, { data: matchRows, error: matchError }] =
        await Promise.all([
          supabase
            .from(DB_TABLES.courtSchedules)
            .select("court_id,day_of_week,open_time,close_time")
            .eq("court_id", selectedCourtId)
            .eq("day_of_week", dayOfWeek),
          supabase
            .from(DB_TABLES.matches)
            .select("scheduled_time,duration_minutes")
            .eq("court_id", selectedCourtId)
            .eq("scheduled_date", selectedDate)
            .neq("match_status", "cancelled"),
        ]);

      if (scheduleError || matchError) {
        setSlots([]);
        setError("No se pudieron cargar los horarios disponibles.");
        return;
      }

      const schedules = (scheduleRows ?? []) as ScheduleInput[];
      const generated = buildSlotsForDay([selectedCourtId], dayDate, schedules);
      const matches = (matchRows ?? []) as MatchRow[];

      const available = generated.filter((slot) => {
        const slotStart = clockToMinutes(slot.time);
        for (const match of matches) {
          const otherStart = clockToMinutes(String(match.scheduled_time ?? ""));
          const otherDur = match.duration_minutes && match.duration_minutes > 0 ? match.duration_minutes : 90;
          if (overlapsSlot(slotStart, slot.duration, otherStart, otherDur)) return false;
        }
        return true;
      });

      setSlots(available);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedCourtId, selectedDate]);

  useEffect(() => {
    if (selectedCourtId && selectedDate) {
      void loadSlots();
    }
  }, [loadSlots, selectedCourtId, selectedDate]);

  const selectedCourt = availableCourts.find((court) => court.id === selectedCourtId) ?? null;
  const canSubmit = Boolean(selectedClubId && selectedCourtId && selectedDate && selectedSlot);

  const resumenPago = useMemo(() => {
    if (!selectedCourt) return { precioCancha: 0, comision: 0, total: 0 };
    const precioCancha = Math.round(selectedCourt.price / 4);
    const comision = Math.round(precioCancha * 0.05);
    return { precioCancha, comision, total: precioCancha + comision };
  }, [selectedCourt]);

  return (
    <form
      className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);
        startSubmit(async () => {
          const result = await crearPartido(formData);
          if (result && "error" in result) {
            setError(result.error);
          }
        });
      }}
    >
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Club</p>
        <select
          name="club_id"
          value={selectedClubId}
          onChange={(event) => setSelectedClubId(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none ring-sky-200 transition focus:ring-2"
        >
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cancha</p>
        <select
          name="court_id"
          value={selectedCourtId}
          onChange={(event) => {
            setSelectedCourtId(event.target.value);
            setSelectedSlot(null);
          }}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none ring-sky-200 transition focus:ring-2"
        >
          {availableCourts.map((court) => (
            <option key={court.id} value={court.id}>
              {court.name} · ${court.price}/turno
            </option>
          ))}
        </select>
        {selectedCourt ? (
          <div className="rounded-2xl bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resumen del pago</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between gap-3 text-sm text-slate-600">
                <span>Precio de cancha</span>
                <span className="shrink-0 font-medium text-slate-700">${fmtAr(resumenPago.precioCancha)}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm text-slate-600">
                <div className="min-w-0 leading-snug">
                  <p>Servicio Padelibre</p>
                  <p>e impuestos incluidos</p>
                </div>
                <span className="shrink-0 self-start font-medium text-slate-700">${fmtAr(resumenPago.comision)}</span>
              </div>
            </div>
            <div className="my-2 border-t border-slate-100" />
            <div className="flex justify-between gap-3 text-base font-bold text-slate-900">
              <span>Total a pagar</span>
              <span>${fmtAr(resumenPago.total)}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              <span className="mr-1" aria-hidden>
                ℹ️
              </span>
              El precio ya incluye todos los impuestos y comisiones del servicio de Padelibre.
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dates.map((date) => {
            const selected = selectedDate === date.key;
            return (
              <button
                key={date.key}
                type="button"
                onClick={() => setSelectedDate(date.key)}
                className={`flex min-w-[4.75rem] shrink-0 flex-col items-center rounded-2xl border px-4 py-3 text-center transition ${
                  selected
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase leading-tight">{date.top}</span>
                <span className="text-lg font-semibold leading-tight">{date.bottom}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Horario</p>
        {loadingSlots ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
            Cargando horarios...
          </div>
        ) : slots.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const selected = selectedSlot?.time === slot.time && selectedSlot.duration === slot.duration;
              return (
                <button
                  key={`${slot.time}-${slot.duration}`}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`min-h-[4rem] rounded-2xl border px-2 py-2 text-xs font-semibold transition ${
                    selected
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                  }`}
                >
                  {slot.time} · {slot.duration}min
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Seleccioná fecha y cancha para ver disponibilidad.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo de partido</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMatchType("amistoso")}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              matchType === "amistoso"
                ? "border-sky-500 bg-sky-500 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Amistoso
          </button>
          <button
            type="button"
            onClick={() => setMatchType("competitivo")}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              matchType === "competitivo"
                ? "border-sky-500 bg-sky-500 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Competitivo
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Visibilidad</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVisibility("publico")}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              visibility === "publico"
                ? "border-sky-500 bg-sky-500 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Publico
          </button>
          <button
            type="button"
            onClick={() => setVisibility("privado")}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              visibility === "privado"
                ? "border-sky-500 bg-sky-500 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Privado
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categoria</p>
        <div className="grid grid-cols-3 gap-2">
          {(["masculino", "femenino", "mixto"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setGenderCategory(option)}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                genderCategory === option
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {option === "masculino" ? "Masculino" : option === "femenino" ? "Femenino" : "Mixto"}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">¿Quién puede unirse?</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLevelRestricted(false)}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              !levelRestricted
                ? "border-sky-500 bg-sky-500 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Cualquier nivel
          </button>
          <button
            type="button"
            onClick={() => setLevelRestricted(true)}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              levelRestricted
                ? "border-sky-500 bg-sky-500 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Mi nivel ±1
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Si está activado, jugadores fuera de tu rango deberán solicitar acceso y los jugadores del
          partido votarán.
        </p>
      </section>

      <input type="hidden" name="scheduled_date" value={selectedDate} />
      <input type="hidden" name="scheduled_time" value={selectedSlot?.time ?? ""} />
      <input type="hidden" name="duration_minutes" value={String(selectedSlot?.duration ?? "")} />
      <input type="hidden" name="match_type" value={matchType} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="gender_category" value={genderCategory} />
      <input type="hidden" name="level_restricted" value={levelRestricted ? "true" : "false"} />

      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </p>
      ) : null}

      {selectedCourt ? (
        <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 text-sm text-slate-800">
          <p className="font-semibold text-sky-900">💳 Cada jugador abona su parte</p>
          <p className="mt-2 font-medium leading-relaxed text-slate-700">
            Al crear el partido pagás{" "}
            <span className="font-bold text-slate-900">${fmtAr(resumenPago.total)}</span> (incluye tu parte del turno
            y el servicio de Padelibre). Los otros jugadores pagarán su parte al unirse. El turno queda confirmado
            cuando los 4 jugadores paguen.
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className={`w-full ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base disabled:opacity-60`}
      >
        {isSubmitting ? "Creando..." : "Crear partido"}
      </button>
    </form>
  );
}
