"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  addDays,
  endOfDay,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import TimeGrid, { type Court, type TimeSlot } from "./TimeGrid";
import MotionPage from "@/components/motion-page";
import { buildSlotsForDay } from "@/lib/court-slots";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { supabase } from "@/lib/supabase";
import type { ClubRow, CourtRow, CourtScheduleRow } from "@/lib/database.types";

type SelectedBooking = {
  courtId: string;
  time: string;
  duration: number;
};

type ClubDetailClientProps = {
  club: Pick<ClubRow, "id" | "name" | "location">;
  courts: CourtRow[];
  schedules: CourtScheduleRow[];
};

export default function ClubDetailClient({
  club,
  courts,
  schedules,
}: ClubDetailClientProps) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clubId = params.id;
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [dayMatches, setDayMatches] = useState<
    { id: string; date: string; court_id: string }[]
  >([]);
  const [selectedBooking, setSelectedBooking] = useState<SelectedBooking>({
    courtId: "",
    time: "",
    duration: 0,
  });

  const courtIds = useMemo(() => courts.map((c) => c.id), [courts]);

  const gridCourts: Court[] = useMemo(
    () =>
      courts.map((c) => ({
        id: c.id,
        name: c.name ?? "Cancha",
        surface: "Cancha",
        pricePerHour: c.price ?? 0,
      })),
    [courts]
  );

  const slots: TimeSlot[] = useMemo(
    () => buildSlotsForDay(courtIds, selectedDate, schedules),
    [courtIds, selectedDate, schedules]
  );

  useEffect(() => {
    if (!courtIds.length) {
      setDayMatches([]);
      return;
    }
    let cancelled = false;
    const start = startOfDay(selectedDate).toISOString();
    const end = endOfDay(selectedDate).toISOString();

    void (async () => {
      const { data } = await supabase
        .from(DB_TABLES.matches)
        .select("id, date, court_id")
        .in("court_id", courtIds)
        .gte("date", start)
        .lte("date", end);

      if (!cancelled) {
        setDayMatches(data ?? []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courtIds, selectedDate]);

  const occupiedMap = useMemo(() => {
    const acc: Record<string, boolean> = {};
    for (const m of dayMatches) {
      const t = format(parseISO(m.date), "HH:mm");
      for (const slot of slots) {
        if (slot.time === t) {
          acc[`${m.court_id}-${slot.time}-${slot.duration}`] = true;
        }
      }
    }
    return acc;
  }, [dayMatches, slots]);

  const next7Days = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => addDays(startOfDay(new Date()), idx)),
    []
  );

  function isBookingComplete() {
    return Boolean(
      selectedBooking.courtId &&
        selectedBooking.time &&
        selectedBooking.duration &&
        selectedBooking.duration > 0
    );
  }

  function handleSelectBooking(courtIdToSelect: string, slot: TimeSlot) {
    setSelectedBooking({
      courtId: courtIdToSelect,
      time: slot.time,
      duration: slot.duration,
    });
  }

  function handleConfirmBooking() {
    if (!isBookingComplete() || !selectedCourt) return;

    const query = new URLSearchParams({
      clubId,
      court: selectedCourt.name,
      time: selectedBooking.time,
      duration: String(selectedBooking.duration),
      date: format(selectedDate, "yyyy-MM-dd"),
    });

    router.push(`/reservas/confirmacion?${query.toString()}`);
  }

  const selectedCourt = gridCourts.find((c) => c.id === selectedBooking.courtId);
  const showBookingBar = Boolean(selectedBooking.courtId || selectedBooking.time);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-40 pt-6 font-sans tracking-tight">
      <Link href="/clubes" className="text-sm font-medium text-sky-500">
        Volver a clubes
      </Link>

      <motion.section
        layoutId={`club-card-${clubId}`}
        className={`${PLAYER_CARD} p-5`}
      >
        <div className="flex items-center gap-4">
          <Image
            src="/club-thumb.svg"
            alt="Vista del club"
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl object-cover"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              {club.name ?? "Club"}
            </h1>
            <p className="mt-1 text-sm font-light text-slate-500">
              {club.location ?? "Elegi fecha, cancha y horario."}
            </p>
          </div>
        </div>
      </motion.section>

      <section className="space-y-3">
        <h2 className="text-base font-bold tracking-tight text-slate-950">Fecha</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {next7Days.map((dateItem) => {
            const active = isSameDay(selectedDate, dateItem);
            return (
              <motion.button
                key={dateItem.toISOString()}
                type="button"
                onClick={() => setSelectedDate(dateItem)}
                whileTap={{ scale: 0.96 }}
                className={`shrink-0 rounded-2xl border px-3 py-2 text-left text-xs transition-all duration-300 ${
                  active
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
                }`}
              >
                <p className="font-semibold">{format(dateItem, "EEE")}</p>
                <p>{format(dateItem, "dd MMM")}</p>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-slate-950">
            Disponibilidad
          </h2>
          <p className="text-xs font-light text-slate-500">
            Segun <code className="text-[10px]">court_schedules</code> y{" "}
            <code className="text-[10px]">matches</code>
          </p>
        </div>
        {gridCourts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Este club no tiene canchas en <code className="text-xs">courts</code>.
          </p>
        ) : (
          <TimeGrid
            courts={gridCourts}
            slots={slots}
            selectedBooking={selectedBooking}
            occupiedMap={occupiedMap}
            onSelect={handleSelectBooking}
          />
        )}
      </section>

      <aside
        className={`fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md transition-transform duration-300 ${
          showBookingBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className={`${PLAYER_CARD} space-y-3 p-4`}>
          <p className="text-sm font-bold tracking-tight text-slate-950">
            Resumen de reserva
          </p>
          <p className="text-xs font-light text-slate-600">
            {selectedCourt
              ? `${selectedCourt.name} · ${selectedBooking.time} · ${selectedBooking.duration} min`
              : "Selecciona cancha y horario para continuar."}
          </p>
          <motion.button
            type="button"
            disabled={!isBookingComplete()}
            onClick={handleConfirmBooking}
            whileTap={{ scale: 0.97 }}
            className={`w-full disabled:cursor-not-allowed disabled:opacity-50 ${PLAYER_PRIMARY_BUTTON}`}
          >
            Confirmar (preview)
          </motion.button>
        </div>
      </aside>
    </MotionPage>
  );
}
