"use client";

import { format, getDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { buildSlotsForDay, type GeneratedSlot, type ScheduleInput } from "@/lib/court-slots";
import { DB_TABLES } from "@/lib/db-tables";
import { normalizeMatchVisibility, type MatchVisibility } from "@/lib/match-visibility";
import { PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/client";
import { updateMatch } from "./actions";

function clockToMinutes(clock: string): number {
  const t = clock.trim().slice(0, 5);
  const [h, m] = t.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function overlapsSlot(
  slotStartMin: number,
  slotDur: number,
  otherStartMin: number,
  otherDur: number
): boolean {
  const slotEnd = slotStartMin + slotDur;
  const otherEnd = otherStartMin + otherDur;
  return slotStartMin < otherEnd && otherStartMin < slotEnd;
}

function normalizeDbTime(t: string | null | undefined): string {
  if (!t) return "";
  return String(t).trim().slice(0, 5);
}

function sameSlot(a: GeneratedSlot, b: GeneratedSlot): boolean {
  return a.time === b.time && a.duration === b.duration;
}

type MatchRow = {
  id: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
};

type BlockRow = { start_time: string | null };

export type EditMatchFormProps = {
  matchId: string;
  courtId: string;
  initialData: {
    match_type: string;
    visibility: string;
    gender_category: string;
    level_restricted: boolean;
    scheduled_date: string;
    scheduled_time: string;
    court_id: string;
    duration_minutes: number;
  };
  onCancel: () => void;
};

function EditFormActions({
  loadingSlots,
  hasSlot,
  onCancel,
}: {
  loadingSlots: boolean;
  hasSlot: boolean;
  onCancel: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="submit"
        disabled={pending || loadingSlots || !hasSlot}
        className={`flex-1 ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base disabled:opacity-60`}
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-2xl border border-slate-200 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-6"
      >
        Cancelar
      </button>
    </div>
  );
}

export default function EditMatchForm({ matchId, courtId, initialData, onCancel }: EditMatchFormProps) {
  const scheduledDate = initialData.scheduled_date;
  const timeInit = normalizeDbTime(initialData.scheduled_time);
  const durInit =
    initialData.duration_minutes > 0 ? initialData.duration_minutes : 90;

  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(() => ({
    time: timeInit,
    duration: 90 as const,
  }));
  const [slots, setSlots] = useState<GeneratedSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<"amistoso" | "competitivo">(
    initialData.match_type?.toLowerCase() === "competitivo" ? "competitivo" : "amistoso"
  );
  const [visibility, setVisibility] = useState<MatchVisibility>(() =>
    normalizeMatchVisibility(initialData.visibility)
  );
  const [genderCategory, setGenderCategory] = useState<"masculino" | "femenino" | "mixto">(() => {
    const g = initialData.gender_category?.toLowerCase();
    if (g === "femenino") return "femenino";
    if (g === "mixto") return "mixto";
    return "masculino";
  });
  const [levelRestricted, setLevelRestricted] = useState(initialData.level_restricted);
  const currentSlot = useMemo<GeneratedSlot>(
    () => ({ time: timeInit, duration: 90 }),
    [timeInit]
  );

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setSlotsError(null);
    try {
      const supabase = createClient();
      const dayDate = parseISO(`${scheduledDate}T12:00:00`);
      const dow = getDay(dayDate);

      const [
        { data: schedRows, error: schedErr },
        { data: matchRows, error: matchErr },
        { data: blockRows, error: blockErr },
        { data: courtRow },
      ] = await Promise.all([
        supabase
          .from(DB_TABLES.courtSchedules)
          .select("court_id,day_of_week,open_time,close_time")
          .eq("court_id", courtId)
          .not("day_of_week", "is", null),
        supabase
          .from(DB_TABLES.matches)
          .select("id,scheduled_time,duration_minutes")
          .eq("court_id", courtId)
          .eq("scheduled_date", scheduledDate)
          .neq("match_status", "cancelled"),
        supabase
          .from(DB_TABLES.courtBlocks)
          .select("start_time")
          .eq("court_id", courtId)
          .eq("date", scheduledDate),
        supabase
          .from(DB_TABLES.courts)
          .select("club_id")
          .eq("id", courtId)
          .maybeSingle(),
      ]);

      if (schedErr || matchErr || blockErr) {
        setSlots([]);
        setSlotsError(
          schedErr?.message ?? matchErr?.message ?? blockErr?.message ?? "No se pudieron cargar los horarios."
        );
        return;
      }

      const clubId = (courtRow as { club_id?: string } | null)?.club_id ?? null;

      const [{ data: clubRow }, { data: clubBlockRows }] = clubId
        ? await Promise.all([
            supabase.from(DB_TABLES.clubs).select("open_time,close_time").eq("id", clubId).maybeSingle(),
            supabase.from(DB_TABLES.clubScheduleBlocks).select("blocked_time").eq("club_id", clubId).eq("day_of_week", dow),
          ])
        : [{ data: null }, { data: [] }];

      const clubBounds = (clubRow as { open_time: string | null; close_time: string | null } | null) ?? null;
      const clubBlockedTimes = new Set(
        ((clubBlockRows ?? []) as Array<{ blocked_time: string }>).map((r) =>
          String(r.blocked_time ?? "").trim().slice(0, 5)
        )
      );

      const schedules = (schedRows ?? []).filter(
        (r) => Number((r as ScheduleInput).day_of_week) === dow
      ) as ScheduleInput[];
      const built = buildSlotsForDay([courtId], dayDate, schedules, clubBounds);
      const matches = (matchRows ?? []) as MatchRow[];
      const blocks = (blockRows ?? []) as BlockRow[];
      const blockStarts = new Set(blocks.map((b) => normalizeDbTime(b.start_time)));

      const filtered = built.filter((slot) => {
        const slotStart = clockToMinutes(slot.time);
        const slotDur = slot.duration;
        if (blockStarts.has(normalizeDbTime(slot.time))) return false;
        if (clubBlockedTimes.size > 0 && clubBlockedTimes.has(slot.time)) return false;
        for (const row of matches) {
          if (row.id === matchId) continue;
          const otherStart = clockToMinutes(normalizeDbTime(row.scheduled_time));
          const otherDur =
            row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
          if (overlapsSlot(slotStart, slotDur, otherStart, otherDur)) return false;
        }
        return true;
      });

      const hasCurrent = filtered.some((s) => sameSlot(s, currentSlot));
      const withCurrent = hasCurrent ? filtered : [currentSlot, ...filtered];

      setSlots(withCurrent);
    } finally {
      setLoadingSlots(false);
    }
  }, [courtId, scheduledDate, matchId, timeInit, currentSlot]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const otherSlotsCount = useMemo(() => {
    return slots.filter((s) => !sameSlot(s, currentSlot)).length;
  }, [slots, currentSlot]);

  const dateLabel =
    scheduledDate.length >= 10
      ? format(parseISO(`${scheduledDate}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es })
      : scheduledDate;

  return (
    <div className="mt-4 rounded-2xl border border-[#0085FC]/20/70 bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Editar partido</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{dateLabel}</p>

      <form className="mt-4 space-y-5" action={updateMatch}>
        <input type="hidden" name="match_id" value={matchId} />
        <input type="hidden" name="scheduled_time" value={selectedSlot?.time ?? timeInit} />
        <input type="hidden" name="duration_minutes" value={String(durInit)} />
        <input type="hidden" name="match_type" value={matchType} />
        <input type="hidden" name="visibility" value={visibility} />
        <input type="hidden" name="gender_category" value={genderCategory} />
        <input type="hidden" name="level_restricted" value={levelRestricted ? "true" : "false"} />

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Horario</p>
          {loadingSlots ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Cargando horarios…
            </p>
          ) : slotsError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {slotsError}
            </p>
          ) : (
            <>
              {otherSlotsCount === 0 && slots.length <= 1 ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  No hay otros horarios disponibles para este día
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const selected = selectedSlot ? sameSlot(selectedSlot, slot) : false;
                  const isCurrent = sameSlot(slot, currentSlot);
                  return (
                    <button
                      key={`${slot.time}-${slot.duration}`}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`flex min-h-[4rem] flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center text-xs font-semibold transition ${
                        selected
                          ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white shadow-md"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#0085FC]/20"
                      } ${isCurrent && !selected ? "ring-2 ring-[#0085FC]/40" : ""}`}
                    >
                      <span>{slot.time}</span>
                      <span className="mt-0.5 opacity-90">{slot.duration} min</span>
                    </button>
                  );
                })}
              </div>
            </>
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
                  ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white"
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
                  ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white"
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
                  ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              Público
            </button>
            <button
              type="button"
              onClick={() => setVisibility("privado")}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                visibility === "privado"
                  ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              Privado
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</p>
          <div className="grid grid-cols-3 gap-2">
            {(["masculino", "femenino", "mixto"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setGenderCategory(opt)}
                className={`rounded-2xl border px-2 py-3 text-xs font-semibold transition ${
                  genderCategory === opt
                    ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {opt === "masculino" ? "Masculino" : opt === "femenino" ? "Femenino" : "Mixto"}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nivel</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLevelRestricted(false)}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                !levelRestricted
                  ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white"
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
                  ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              Mi nivel ±1
            </button>
          </div>
        </section>

        <EditFormActions loadingSlots={loadingSlots} hasSlot={Boolean(selectedSlot)} onCancel={onCancel} />
      </form>
    </div>
  );
}
