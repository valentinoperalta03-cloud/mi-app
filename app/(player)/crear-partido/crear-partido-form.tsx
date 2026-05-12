"use client";

import Image from "next/image";
import Link from "next/link";
import { addDays, format, getDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { ChevronRight, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { ScheduleInput } from "@/lib/court-slots";
import { formatDateInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { crearPartido } from "./actions";

function fmtAr(numero: number) {
  return new Intl.NumberFormat("es-AR").format(numero);
}

function clubInitials(name: string): string {
  const n = name.trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0] + parts[1]![0]).toUpperCase();
  return n.slice(0, 2).toUpperCase() || "CL";
}

export type GenderCategory = "masculino" | "femenino" | "mixto";

export type ClubOption = {
  id: string;
  name: string;
  location: string;
  description?: string | null;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  logoUrl?: string | null;
};

export type CourtOption = {
  id: string;
  clubId: string;
  name: string;
  price: number;
};
export type SlotPriceOption = {
  courtId: string;
  startTime: string;
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
type TurnSlot = {
  time: string;
  endTime: string;
  duration: number;
};
type Step = "clubs" | "club-detail" | "options" | "payment";

const COURT_TURNS: TurnSlot[] = [
  { time: "09:00", endTime: "10:30", duration: 90 },
  { time: "10:30", endTime: "12:00", duration: 90 },
  { time: "12:00", endTime: "13:30", duration: 90 },
  { time: "13:30", endTime: "15:00", duration: 90 },
  { time: "15:00", endTime: "16:30", duration: 90 },
  { time: "16:30", endTime: "18:00", duration: 90 },
  { time: "18:00", endTime: "19:30", duration: 90 },
  { time: "19:30", endTime: "21:00", duration: 90 },
  { time: "21:00", endTime: "22:30", duration: 90 },
  { time: "22:30", endTime: "23:59", duration: 89 },
];

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

function slotFitsInWindows(slot: TurnSlot, windows: ScheduleInput[]): boolean {
  if (windows.length === 0) return true;
  const slotStart = clockToMinutes(slot.time);
  const slotEnd = clockToMinutes(slot.endTime);
  return windows.some((window) => {
    if (!window.open_time || !window.close_time) return false;
    const winStart = clockToMinutes(String(window.open_time).slice(0, 5));
    const winEnd = clockToMinutes(String(window.close_time).slice(0, 5));
    return slotStart >= winStart && slotEnd <= winEnd;
  });
}

function resolveInitialClubId(clubs: ClubOption[], defaultClubId?: string): string {
  if (defaultClubId && clubs.some((c) => c.id === defaultClubId)) return defaultClubId;
  return clubs[0]?.id ?? "";
}

export default function CrearPartidoForm({
  clubs,
  courts,
  slotPrices,
  defaultGender,
  friends,
  defaultClubId,
}: {
  clubs: ClubOption[];
  courts: CourtOption[];
  slotPrices: SlotPriceOption[];
  defaultGender: GenderCategory;
  friends: FriendOption[];
  defaultClubId?: string;
}) {
  const initialClubId = resolveInitialClubId(clubs, defaultClubId);
  const [currentStep, setCurrentStep] = useState<Step>("clubs");
  const [selectedClub, setSelectedClub] = useState<ClubOption | null>(
    () => clubs.find((c) => c.id === initialClubId) ?? clubs[0] ?? null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClubId, setSelectedClubId] = useState<string>(initialClubId);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TurnSlot | null>(null);
  const [slots, setSlots] = useState<TurnSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<"amistoso" | "competitivo">("amistoso");
  const [visibility, setVisibility] = useState<"publico" | "privado">("publico");
  const [genderCategory, setGenderCategory] = useState<GenderCategory>(defaultGender);
  const [levelRestricted, setLevelRestricted] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
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

  const availableCourts = useMemo(() => {
    const list = courts.filter((court) => court.clubId === selectedClubId);
    return Array.from(new Map(list.map((c) => [c.id, c])).values());
  }, [courts, selectedClubId]);
  const filteredClubs = useMemo(
    () => clubs.filter((club) => club.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [clubs, searchQuery]
  );
  const slotPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of slotPrices) {
      map.set(`${row.courtId}__${row.startTime}`, row.price);
    }
    return map;
  }, [slotPrices]);
  const minPriceByCourt = useMemo(() => {
    const map = new Map<string, number>();
    for (const court of courts) {
      map.set(court.id, court.price);
    }
    for (const row of slotPrices) {
      const current = map.get(row.courtId);
      if (current == null || row.price < current) {
        map.set(row.courtId, row.price);
      }
    }
    return map;
  }, [courts, slotPrices]);

  const getTurnPrice = useCallback(
    (courtId: string, startTime: string): number => {
      const slotPrice = slotPriceMap.get(`${courtId}__${startTime}`);
      if (slotPrice != null) return slotPrice;
      return courts.find((c) => c.id === courtId)?.price ?? 0;
    },
    [courts, slotPriceMap]
  );

  useEffect(() => {
    if (!selectedClubId) return;
    const foundClub = clubs.find((club) => club.id === selectedClubId) ?? null;
    setSelectedClub(foundClub);
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
            .not("day_of_week", "is", null),
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

      const schedules = (scheduleRows ?? []).filter(
        (r) => Number((r as ScheduleInput).day_of_week) === dayOfWeek
      ) as ScheduleInput[];
      const matches = (matchRows ?? []) as MatchRow[];

      const available = COURT_TURNS.filter((slot) => {
        if (!slotFitsInWindows(slot, schedules)) return false;
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
    if (!selectedCourt || !selectedSlot) return { total: 0 };
    const turnPrice = getTurnPrice(selectedCourt.id, selectedSlot.time);
    const precioCanchaJugador = Math.round(turnPrice / 4);
    const comisionPorJugador = Math.round(precioCanchaJugador * 0.05);
    const total = precioCanchaJugador + comisionPorJugador;
    return { total };
  }, [getTurnPrice, selectedCourt, selectedSlot]);

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((prev) => {
      const exists = prev.includes(friendId);
      if (exists) {
        return prev.filter((id) => id !== friendId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, friendId];
    });
  }

  return (
    <form
      className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);
        startSubmit(async () => {
          try {
            const result = (await crearPartido(formData)) as { error?: string } | void;
            if (result && "error" in result) setError(result.error ?? "No se pudo crear el partido.");
          } catch {
            // Si hay redirect del server action, Next resuelve fuera del cliente.
          }
        });
      }}
    >
      {currentStep === "clubs" ? (
        <div className="space-y-4">
          <header className="space-y-1">
            <Link href="/home" className="text-sm font-semibold text-[#0585FC]">
              ← Volver
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">¿Dónde querés jugar?</h1>
            <p className="text-sm text-slate-500">Elegí un club para ver sus canchas</p>
          </header>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar club..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm outline-none focus:border-[#0585FC] focus:ring-2 focus:ring-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-3">
            {filteredClubs.map((club) => {
              const cover = club.coverImageUrl?.trim() || null;
              const logo = club.logoUrl?.trim() || null;
              const thumbFallback = club.imageUrl?.trim() || null;
              return (
                <button
                  key={club.id}
                  type="button"
                  onClick={() => {
                    setSelectedClub(club);
                    setSelectedClubId(club.id);
                    setCurrentStep("club-detail");
                  }}
                  className={`relative w-full overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${
                    cover
                      ? "border-black/[0.06] dark:border-white/[0.06]"
                      : "border-black/[0.06] bg-white dark:border-white/[0.06]"
                  }`}
                >
                  {cover ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- URL de Supabase storage */}
                      <img
                        src={cover}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/25" />
                    </>
                  ) : null}
                  <div className="relative z-10 flex items-center gap-4">
                    <div
                      className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${
                        cover ? "border-2 border-white/90 bg-white/10 shadow-md ring-1 ring-white/20" : "bg-[#0585FC]/10"
                      }`}
                    >
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL de Supabase storage
                        <img src={logo} alt="" className="h-full w-full object-cover" />
                      ) : thumbFallback ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbFallback} alt={club.name} className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                          style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
                        >
                          {clubInitials(club.name)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-bold ${cover ? "text-white drop-shadow-sm" : "text-slate-900 dark:text-white"}`}
                      >
                        {club.name}
                      </p>
                      <p
                        className={`mt-0.5 flex items-center gap-1 text-sm ${cover ? "text-white/85" : "text-slate-500"}`}
                      >
                        <MapPin size={11} />
                        {club.location?.trim() || "Ciudad no indicada"}
                      </p>
                    </div>
                    <ChevronRight size={18} className={`shrink-0 ${cover ? "text-white/90" : "text-slate-400"}`} />
                  </div>
                </button>
              );
            })}
            {filteredClubs.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                No encontramos clubes con ese nombre.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {currentStep === "club-detail" ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setCurrentStep("clubs")}
            className="flex items-center gap-1 text-sm font-semibold text-[#0585FC]"
          >
            ← Volver a clubes
          </button>

          <div className="relative h-48 w-full overflow-hidden rounded-3xl bg-[#0585FC]/10">
            {(() => {
              const heroSrc =
                selectedClub?.coverImageUrl?.trim() ||
                selectedClub?.logoUrl?.trim() ||
                selectedClub?.imageUrl?.trim() ||
                null;
              const logoSrc = selectedClub?.logoUrl?.trim() || null;
              const clubName = selectedClub?.name ?? "Club";
              return (
                <>
                  {heroSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL de Supabase storage
                    <img src={heroSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
                    >
                      <svg width="80" height="80" viewBox="0 0 80 80" opacity="0.3">
                        <circle cx="40" cy="40" r="36" fill="none" stroke="white" strokeWidth="3" />
                        <path d="M12 32 Q40 28 68 32" stroke="white" strokeWidth="2.5" fill="none" />
                        <path d="M12 40 Q40 36 68 40" stroke="white" strokeWidth="2.5" fill="none" />
                        <path d="M12 48 Q40 44 68 48" stroke="white" strokeWidth="2.5" fill="none" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoSrc}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white object-cover shadow-lg"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-white/15 text-lg font-bold text-white backdrop-blur-sm">
                        {clubName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 pb-0.5">
                      <h1 className="text-xl font-bold leading-tight tracking-tight text-white drop-shadow-sm">
                        {clubName}
                      </h1>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-white/85">
                        <MapPin size={12} />
                        {selectedClub?.location}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {selectedClub?.description ? (
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{selectedClub.description}</p>
          ) : null}

          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Elegí tu cancha y horario</h2>

            <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {dates.map((date) => (
                <button
                  key={date.key}
                  type="button"
                  onClick={() => {
                    setSelectedDate(date.key);
                    setSelectedSlot(null);
                  }}
                  className={`flex min-w-[4rem] shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 text-center transition-all ${
                    selectedDate === date.key
                      ? "border-[#0585FC] bg-[#0585FC] text-white"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase">{date.top}</span>
                  <span className="text-lg font-bold leading-tight">{date.bottom}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {availableCourts.map((court) => (
                <div
                  key={court.id}
                  className="rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.06]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{court.name}</p>
                      <p className="text-sm font-semibold text-[#0585FC]">
                        Desde ${new Intl.NumberFormat("es-AR").format(minPriceByCourt.get(court.id) ?? court.price)}/turno
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800">
                      90 min
                    </span>
                  </div>

                  {selectedDate && selectedCourtId === court.id ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {loadingSlots ? (
                        <p className="col-span-3 py-2 text-center text-sm text-slate-400">Cargando horarios...</p>
                      ) : slots.length === 0 ? (
                        <p className="col-span-3 py-2 text-center text-sm text-slate-400">Sin horarios disponibles</p>
                      ) : (
                        slots.map((slot) => (
                          <button
                            key={`${slot.time}-${slot.duration}`}
                            type="button"
                            onClick={() => {
                              setSelectedSlot(slot);
                              setCurrentStep("options");
                            }}
                            className={`rounded-xl border py-2.5 text-center text-xs font-semibold transition-all ${
                              selectedSlot?.time === slot.time
                                ? "border-[#0585FC] bg-[#0585FC] text-white"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#0585FC]/30 dark:border-slate-700 dark:bg-slate-800"
                            }`}
                          >
                            <span className="block">{slot.time}</span>
                            <span className="block opacity-60">{slot.duration}min</span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}

                  {selectedCourtId !== court.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourtId(court.id);
                        setSelectedSlot(null);
                      }}
                      className="mt-2 w-full rounded-xl border border-[#0585FC]/20 bg-[#0585FC]/5 py-2 text-sm font-semibold text-[#0585FC] transition-colors hover:bg-[#0585FC]/10"
                    >
                      Ver horarios disponibles
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {currentStep === "options" ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setCurrentStep("club-detail")}
            className="flex items-center gap-1 text-sm font-semibold text-[#0585FC]"
          >
            ← Volver a la cancha
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Opciones del partido</h1>
            <p className="mt-1 text-sm text-slate-500">
              {selectedClub?.name} ·{" "}
              {selectedDate
                ? formatDateInArgentina(`${selectedDate}T12:00:00`, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}{" "}
              · {selectedSlot?.time}
            </p>
          </div>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo de partido</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMatchType("amistoso")}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  matchType === "amistoso"
                    ? "border-[#0585FC] bg-[#0585FC] text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Amistoso
              </button>
              <button
                type="button"
                onClick={() => setMatchType("competitivo")}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  matchType === "competitivo"
                    ? "border-[#0585FC] bg-[#0585FC] text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                    ? "border-[#0585FC] bg-[#0585FC] text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Público
              </button>
              <button
                type="button"
                onClick={() => setVisibility("privado")}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  visibility === "privado"
                    ? "border-[#0585FC] bg-[#0585FC] text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Privado
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</p>
            <div className="grid grid-cols-3 gap-2">
              {(["masculino", "femenino", "mixto"] as const).map((option) => {
                const isDisabled =
                  (option === "femenino" && defaultGender === "masculino") ||
                  (option === "masculino" && defaultGender === "femenino");
                const showFemeninoMismatch =
                  option === "femenino" && defaultGender === "masculino" && isDisabled;
                return (
                  <div key={option} className="flex min-w-0 flex-col gap-1">
                    <button
                      type="button"
                      disabled={isDisabled}
                      title={showFemeninoMismatch ? "Tu género no coincide" : undefined}
                      onClick={() => !isDisabled && setGenderCategory(option)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                        isDisabled
                          ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-40 dark:border-slate-800 dark:bg-slate-900/40"
                          : genderCategory === option
                            ? "border-[#0585FC] bg-[#0585FC] text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[#0585FC]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {option === "masculino" ? "Masculino" : option === "femenino" ? "Femenino" : "Mixto"}
                    </button>
                    {showFemeninoMismatch ? (
                      <p className="text-center text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                        Tu género no coincide
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {defaultGender === "masculino" ? (
              <p className="text-xs text-slate-400">Solo podés crear partidos masculinos o mixtos.</p>
            ) : null}
            {defaultGender === "femenino" ? (
              <p className="text-xs text-slate-400">Solo podés crear partidos femeninos o mixtos.</p>
            ) : null}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">¿Quién puede unirse?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLevelRestricted(false)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  !levelRestricted
                    ? "border-[#0585FC] bg-[#0585FC] text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Cualquier nivel
              </button>
              <button
                type="button"
                onClick={() => setLevelRestricted(true)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  levelRestricted
                    ? "border-[#0585FC] bg-[#0585FC] text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Mi nivel ±1
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Si está activado, jugadores fuera de tu rango deberán solicitar acceso y los jugadores del partido votarán.
            </p>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invitar amigos</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seleccioná hasta 3 amigos para completar el partido (4 jugadores contando al creador).
            </p>
            {friends.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
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
                      })
                    );
                    return (
                      <button
                        key={friend.userId}
                        type="button"
                        onClick={() => toggleFriend(friend.userId)}
                        className={`min-w-[12rem] rounded-2xl border px-3 py-3 text-left transition ${
                          selected
                            ? "border-[#0585FC]/20 bg-[#0585FC]/5 dark:bg-[#0585FC]/10"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 dark:border-slate-700">
                            {friend.avatarUrl ? (
                              <Image src={friend.avatarUrl} alt={friend.name} fill className="object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center bg-[#0585FC]/10 text-xs font-semibold text-[#0461C4]">
                                {friend.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{friend.name}</p>
                            <p className="mt-1 text-xs font-medium text-[#0461C4]">{nivelParts.category || "Sin nivel"}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => setCurrentStep("payment")}
            disabled={!canSubmit}
          >
            Continuar al pago →
          </Button>
        </div>
      ) : null}

      {currentStep === "payment" ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setCurrentStep("options")}
            className="flex items-center gap-1 text-sm font-semibold text-[#0585FC]"
          >
            ← Volver a opciones
          </button>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Confirmá tu partido</h1>

          <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white dark:border-white/[0.06]">
            <div
              className="flex h-20 w-full items-center gap-3 bg-[#0585FC]/10 px-5"
              style={{ background: "var(--color-brand-gradient)" }}
            >
              <div>
                <p className="font-bold text-white">{selectedClub?.name}</p>
                <p className="text-sm text-white/70">{selectedClub?.location}</p>
              </div>
            </div>

            <div className="space-y-3 p-5">
              {[
                { label: "Cancha", value: availableCourts.find((c) => c.id === selectedCourtId)?.name },
                {
                  label: "Fecha",
                  value: selectedDate
                    ? formatDateInArgentina(`${selectedDate}T12:00:00`, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : undefined,
                },
                { label: "Hora", value: selectedSlot?.time },
                { label: "Duración", value: `${selectedSlot?.duration ?? "—"} minutos` },
                { label: "Tipo", value: matchType === "competitivo" ? "Competitivo" : "Amistoso" },
                { label: "Categoría", value: genderCategory },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="capitalize font-semibold text-slate-900 dark:text-white">{value ?? "—"}</span>
                </div>
              ))}

              <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-base font-bold text-slate-900 dark:text-white">
                  Total a pagar:{" "}
                  <span className="text-lg font-bold text-[#0585FC]">${fmtAr(resumenPago.total)}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400">💳 Los otros jugadores pagarán su parte al unirse</p>

          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? "Procesando..." : "Confirmar y pagar 🎾"}
          </Button>
        </div>
      ) : null}

      <input type="hidden" name="club_id" value={selectedClubId} />
      <input type="hidden" name="court_id" value={selectedCourtId} />
      <input type="hidden" name="scheduled_date" value={selectedDate} />
      <input type="hidden" name="scheduled_time" value={selectedSlot?.time ?? ""} />
      <input type="hidden" name="duration_minutes" value={String(selectedSlot?.duration ?? "")} />
      <input type="hidden" name="match_type" value={matchType} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="gender_category" value={genderCategory} />
      <input type="hidden" name="level_restricted" value={levelRestricted ? "true" : "false"} />
      <input type="hidden" name="invited_friend_ids" value={selectedFriendIds.join(",")} />
    </form>
  );
}
