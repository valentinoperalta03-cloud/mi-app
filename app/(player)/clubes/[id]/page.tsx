"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import TimeGrid, { type Court, type TimeSlot } from "./TimeGrid";
import MotionPage from "@/components/motion-page";

type SelectedBooking = {
  courtId: string;
  time: string;
  duration: number;
};

const mockCourts: Court[] = [
  { id: "court-1", name: "Cancha 1", surface: "Cesped Azul", pricePerHour: 22_000 },
  { id: "court-2", name: "Cancha 2", surface: "Panoramica", pricePerHour: 25_000 },
  { id: "court-3", name: "Cancha 3", surface: "Techada", pricePerHour: 24_000 },
];

const mockSlots: TimeSlot[] = [
  { time: "08:00", duration: 60 },
  { time: "09:30", duration: 90 },
  { time: "11:00", duration: 60 },
  { time: "12:30", duration: 90 },
  { time: "14:00", duration: 60 },
  { time: "15:30", duration: 90 },
  { time: "17:00", duration: 60 },
  { time: "18:30", duration: 90 },
  { time: "20:00", duration: 60 },
  { time: "21:30", duration: 90 },
  { time: "23:00", duration: 60 },
];

const occupiedKeys = new Set(["court-1-09:30-90", "court-2-17:00-60", "court-3-20:00-60"]);

export default function ClubDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clubId = params.id;
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedBooking, setSelectedBooking] = useState<SelectedBooking>({
    courtId: "",
    time: "",
    duration: 0,
  });

  const next7Days = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => addDays(startOfDay(new Date()), idx)),
    []
  );

  const occupiedMap = useMemo(
    () =>
      mockSlots.reduce<Record<string, boolean>>((acc, slot) => {
        mockCourts.forEach((court) => {
          const key = `${court.id}-${slot.time}-${slot.duration}`;
          acc[key] = occupiedKeys.has(key);
        });
        return acc;
      }, {}),
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

  const selectedCourt = mockCourts.find((court) => court.id === selectedBooking.courtId);
  const showBookingBar = Boolean(selectedBooking.courtId || selectedBooking.time);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-40 pt-6 font-sans tracking-tight">
      <Link href="/clubes" className="text-sm font-medium text-sky-500">
        Volver a clubes
      </Link>

      <motion.section
        layoutId={`club-card-${clubId}`}
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Club {clubId}</h1>
            <p className="mt-1 text-sm font-light text-slate-500">
              Elegi fecha, cancha y horario para avanzar con la reserva.
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
                    ? "border-sky-600 bg-sky-600 text-white"
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
          <h2 className="text-base font-bold tracking-tight text-slate-950">Disponibilidad</h2>
          <p className="text-xs font-light text-slate-500">Intervalos 60m y 90m</p>
        </div>
        <TimeGrid
          courts={mockCourts}
          slots={mockSlots}
          selectedBooking={selectedBooking}
          occupiedMap={occupiedMap}
          onSelect={handleSelectBooking}
        />
      </section>

      <aside
        className={`fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md transition-transform duration-300 ${
          showBookingBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold tracking-tight text-slate-950">Resumen de reserva</p>
          <p className="text-xs font-light text-slate-600">
            {selectedCourt
              ? `${selectedCourt.name} • ${selectedBooking.time} • ${selectedBooking.duration} min`
              : "Selecciona cancha y horario para continuar."}
          </p>
          <motion.button
            type="button"
            disabled={!isBookingComplete()}
            onClick={handleConfirmBooking}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            Confirmar Reserva
          </motion.button>
        </div>
      </aside>
    </MotionPage>
  );
}
