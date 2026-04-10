"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { PLAYER_CARD } from "@/lib/player-ui";

export type Court = {
  id: string;
  name: string;
  surface: string;
  pricePerHour: number;
};

export type TimeSlot = {
  time: string;
  duration: 60 | 90;
};

type SelectedBooking = {
  courtId: string;
  time: string;
  duration: number;
};

type TimeGridProps = {
  courts: Court[];
  slots: TimeSlot[];
  selectedBooking: SelectedBooking;
  occupiedMap: Record<string, boolean>;
  onSelect: (courtId: string, slot: TimeSlot) => void;
};

export default function TimeGrid({
  courts,
  slots,
  selectedBooking,
  occupiedMap,
  onSelect,
}: TimeGridProps) {
  return (
    <div className={`overflow-x-auto ${PLAYER_CARD}`}>
      <div className="grid min-w-[760px] grid-cols-[88px_repeat(3,minmax(210px,1fr))]">
        <div className="sticky left-0 z-10 border-b border-r border-slate-100 bg-slate-50 p-3 text-xs font-semibold tracking-tight text-slate-600">
          Hora
        </div>
        {courts.map((court) => (
          <div
            key={court.id}
            className="border-b border-slate-100 bg-slate-50 p-3 text-xs font-semibold tracking-tight text-slate-700"
          >
            <p className="text-sm text-slate-900">{court.name}</p>
            <p className="text-slate-500">{court.surface}</p>
          </div>
        ))}

        {slots.map((slot) => (
          <Fragment key={`${slot.time}-${slot.duration}`}>
            <div
              className="sticky left-0 z-10 border-r border-t border-slate-100 bg-white p-3 text-xs font-medium text-slate-500"
            >
              {slot.time}
              <span className="ml-1 text-[10px] text-slate-400">{slot.duration}m</span>
            </div>
            {courts.map((court) => {
              const bookingKey = `${court.id}-${slot.time}-${slot.duration}`;
              const occupied = occupiedMap[bookingKey] ?? false;
              const isSelected =
                selectedBooking.courtId === court.id &&
                selectedBooking.time === slot.time &&
                selectedBooking.duration === slot.duration;

              return (
                <motion.button
                  key={bookingKey}
                  type="button"
                  disabled={occupied}
                  onClick={() => onSelect(court.id, slot)}
                  whileTap={occupied ? undefined : { scale: 0.97 }}
                  className={`border-t border-slate-100 p-3 text-left text-xs transition-all duration-300 ${
                    occupied
                      ? "cursor-not-allowed bg-slate-100 text-slate-400 opacity-60"
                      : isSelected
                        ? "border-sky-200 bg-sky-500 text-white shadow-sm"
                        : "bg-white text-slate-700 hover:bg-sky-50 hover:border-sky-100"
                  }`}
                >
                  {occupied ? "Ocupada" : isSelected ? "Seleccionada" : "Disponible"}
                </motion.button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

