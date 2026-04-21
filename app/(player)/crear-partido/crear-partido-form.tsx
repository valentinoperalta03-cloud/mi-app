"use client";

import Image from "next/image";
import { addDays, format, getDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { buildSlotsForDay, type GeneratedSlot, type ScheduleInput } from "@/lib/court-slots";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
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

export type FriendOption = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  level: number | null;
  levelOfPlay: string | null;
  technicalScore: number | null;
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
  friends,
}: {
  clubs: ClubOption[];
  courts: CourtOption[];
  defaultGender: GenderCategory;
  friends: FriendOption[];
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
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [paidForFriendIds, setPaidForFriendIds] = useState<string[]>([]);
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
    if (!selectedCourt) return { precioCanchaJugador: 0, comisionPorJugador: 0, total: 0, jugadoresPagados: 1 };
    const precioCanchaJugador = Math.round(selectedCourt.price / 4);
    const comisionPorJugador = Math.round(precioCanchaJugador * 0.05);
    const jugadoresPagados = 1 + paidForFriendIds.length;
    const total = (precioCanchaJugador + comisionPorJugador) * jugadoresPagados;
    return { precioCanchaJugador, comisionPorJugador, total, jugadoresPagados };
  }, [selectedCourt, paidForFriendIds.length]);

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((prev) => {
      const exists = prev.includes(friendId);
      if (exists) {
        setPaidForFriendIds((paid) => paid.filter((id) => id !== friendId));
        return prev.filter((id) => id !== friendId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, friendId];
    });
  }

  function togglePaidFor(friendId: string) {
    if (!selectedFriendIds.includes(friendId)) return;
    setPaidForFriendIds((prev) => (prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]));
  }

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
          <motion.div
            layout
            className="rounded-2xl bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resumen del pago</p>
            <div className="mt-2 flex items-center gap-2 opacity-70">
              <div className="relative h-5 w-16 overflow-hidden rounded-md border border-slate-200/70 bg-white/90">
                <Image src="/logo-marca.png" alt="Padelibre" fill className="object-contain p-0.5" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between gap-3 text-sm text-slate-600">
                <span>Precio por jugador</span>
                <span className="shrink-0 font-medium text-slate-700">${fmtAr(resumenPago.precioCanchaJugador)}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm text-slate-600">
                <div className="min-w-0 leading-snug">
                  <p>Servicio Padelibre</p>
                  <p>e impuestos incluidos</p>
                </div>
                <span className="shrink-0 self-start font-medium text-slate-700">
                  ${fmtAr(resumenPago.comisionPorJugador)}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm text-slate-600">
                <span>Jugadores que pagás ahora</span>
                <span className="shrink-0 font-medium text-slate-700">{resumenPago.jugadoresPagados}</span>
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
          </motion.div>
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

      {selectedSlot ? (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invitar amigos</p>
          <p className="text-xs text-slate-500">
            Seleccioná hasta 3 amigos para completar el partido (4 jugadores contando al creador).
          </p>
          {friends.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Todavía no tenés amigos agregados.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {friends.map((friend) => {
                  const selected = selectedFriendIds.includes(friend.userId);
                  const nivelParts = splitOfficialCategoryLine(
                    formatProfileNivelFromRow({
                      level: friend.level,
                      level_of_play: friend.levelOfPlay,
                      technical_score: friend.technicalScore,
                    })
                  );
                  return (
                    <button
                      key={friend.userId}
                      type="button"
                      onClick={() => toggleFriend(friend.userId)}
                      className={`min-w-[12rem] rounded-2xl border px-3 py-3 text-left transition ${
                        selected ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200">
                          {friend.avatarUrl ? (
                            <Image src={friend.avatarUrl} alt={friend.name} fill className="object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center bg-sky-100 text-xs font-semibold text-sky-700">
                              {friend.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{friend.name}</p>
                          <p className="mt-1 text-xs font-medium text-sky-700">{nivelParts.category || "Sin nivel"}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedFriendIds.map((friendId) => {
                const friend = friends.find((f) => f.userId === friendId);
                if (!friend) return null;
                const checked = paidForFriendIds.includes(friendId);
                return (
                  <label
                    key={`pay-${friendId}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-slate-700">¿Pagar por esta persona? ({friend.name})</span>
                    <button
                      type="button"
                      aria-pressed={checked}
                      onClick={() => togglePaidFor(friendId)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                        checked ? "bg-sky-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          checked ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

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
      <input type="hidden" name="invited_friend_ids" value={selectedFriendIds.join(",")} />
      <input type="hidden" name="paid_friend_ids" value={paidForFriendIds.join(",")} />

      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </p>
      ) : null}

      {selectedCourt ? (
        <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 text-sm text-slate-800">
          <p className="font-semibold text-sky-900">💳 Pago inicial del creador</p>
          <p className="mt-2 font-medium leading-relaxed text-slate-700">
            Al crear el partido pagás{" "}
            <span className="font-bold text-slate-900">${fmtAr(resumenPago.total)}</span> (incluye tu parte del turno
            y el servicio de Padelibre). Si marcás "¿Pagar por él/ella?" para un invitado, su parte también se suma a
            este pago.
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
