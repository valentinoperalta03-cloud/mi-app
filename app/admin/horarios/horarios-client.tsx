"use client";

import { useEffect, useState, useTransition } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";
import { toggleClubScheduleBlock } from "./actions";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function minToClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function generateSlots(openTime: string): Array<{ start: string; end: string }> {
  const openMin = parseTime(openTime);
  const slots: Array<{ start: string; end: string }> = [];
  for (let t = openMin; t < 24 * 60; t += 90) {
    const end = t + 90;
    slots.push({
      start: minToClock(t),
      end: end >= 24 * 60 ? "00:00" : minToClock(end),
    });
  }
  return slots;
}

type Props = {
  clubId: string;
  openTime: string;
  initialBlocks: Array<{ day_of_week: number; blocked_time: string }>;
};

export default function HorariosClient({ clubId, openTime, initialBlocks }: Props) {
  const [selectedDay, setSelectedDay] = useState(1); // Lunes por defecto
  const [blocks, setBlocks] = useState<Set<string>>(
    () => new Set(initialBlocks.map((b) => `${b.day_of_week}__${b.blocked_time}`))
  );
  const [pending, startTransition] = useTransition();

  const slots = generateSlots(openTime);

  // Realtime: escucha cambios en club_schedule_blocks para este club
  useEffect(() => {
    const supabase = createClient();

    async function onBlockChange() {
      const { data } = await supabase
        .from(DB_TABLES.clubScheduleBlocks)
        .select("day_of_week,blocked_time")
        .eq("club_id", clubId);
      if (data) {
        setBlocks(
          new Set(
            (data as Array<{ day_of_week: number; blocked_time: string }>).map(
              (b) => `${b.day_of_week}__${b.blocked_time}`
            )
          )
        );
      }
    }

    function subscribe() {
      return supabase
        .channel(`club-blocks-${clubId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: DB_TABLES.clubScheduleBlocks, filter: `club_id=eq.${clubId}` },
          () => void onBlockChange()
        )
        .subscribe();
    }

    let channel = subscribe();
    let cleanupNetwork: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      void Network.addListener("networkStatusChange", (status) => {
        if (!status.connected) return;
        void supabase.removeChannel(channel).then(() => {
          channel = subscribe();
          // Re-fetch current state after reconnect in case changes were missed.
          void onBlockChange();
        });
      }).then((handle) => {
        cleanupNetwork = () => void handle.remove();
      });
    }

    return () => {
      void supabase.removeChannel(channel);
      cleanupNetwork?.();
    };
  }, [clubId]);

  function isBlocked(day: number, time: string) {
    return blocks.has(`${day}__${time}`);
  }

  function handleToggle(time: string) {
    const key = `${selectedDay}__${time}`;
    // Optimistic update
    setBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    startTransition(async () => {
      const result = await toggleClubScheduleBlock(clubId, selectedDay, time);
      if (!result.ok) {
        // Revertir si falló
        setBlocks((prev) => {
          const next = new Set(prev);
          if (result.blocked) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    });
  }

  const blockedCount = slots.filter((s) => isBlocked(selectedDay, s.start)).length;

  return (
    <div className="space-y-5">
      {/* Tabs días */}
      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {DAY_SHORT.map((label, idx) => {
          const dayBlockCount = slots.filter((s) => blocks.has(`${idx}__${s.start}`)).length;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedDay(idx)}
              className={`relative flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-3.5 py-2 text-xs font-semibold transition-all ${
                selectedDay === idx
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {label}
              {dayBlockCount > 0 ? (
                <span className={`text-[10px] font-bold ${selectedDay === idx ? "text-rose-300" : "text-rose-500"}`}>
                  {dayBlockCount} bloq.
                </span>
              ) : (
                <span className={`text-[10px] ${selectedDay === idx ? "text-slate-300" : "text-slate-400"}`}>
                  libre
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Header del día */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{DAY_LABELS[selectedDay]}</p>
          <p className="text-xs text-slate-500">
            {blockedCount === 0
              ? "Todos los turnos disponibles"
              : `${blockedCount} turno${blockedCount !== 1 ? "s" : ""} bloqueado${blockedCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        {blockedCount > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              slots.forEach((s) => {
                if (isBlocked(selectedDay, s.start)) handleToggle(s.start);
              });
            }}
            className="rounded-xl border border-rose-200 bg-rose-100/60 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
          >
            Desbloquear todos
          </button>
        ) : null}
      </div>

      {/* Grid de turnos */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((slot) => {
          const blocked = isBlocked(selectedDay, slot.start);
          return (
            <button
              key={slot.start}
              type="button"
              disabled={pending}
              onClick={() => handleToggle(slot.start)}
              className={`flex flex-col items-center rounded-2xl border px-3 py-3 text-sm font-semibold transition-all disabled:opacity-60 ${
                blocked
                  ? "border-rose-300 bg-rose-100 text-rose-800 ring-1 ring-rose-200 hover:bg-rose-200 dark:border-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
                  : "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
              }`}
            >
              <span>
                {slot.start} → {slot.end}
              </span>
              <span className={`mt-0.5 text-[11px] font-medium ${blocked ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                {blocked ? "Bloqueado" : "Disponible"}
              </span>
            </button>
          );
        })}
      </div>

      {pending ? (
        <p className="text-center text-xs text-slate-400">Guardando…</p>
      ) : null}
    </div>
  );
}
