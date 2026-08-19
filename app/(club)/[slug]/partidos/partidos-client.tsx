"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Space_Grotesk } from "next/font/google";
import { useEffect, useMemo, useState, useTransition } from "react";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { abrirPartido, getClubAvailability, type AvailabilitySlot } from "../actions";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });

export type PartidosClub = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string | null;
  province: string | null;
  business_hours: string | null;
};

export type PartidosCourt = {
  id: string;
  name: string | null;
  surface: string | null;
  indoor: boolean | null;
  price: number | null;
};

export type OpenMatchParticipant = {
  player_id: string | null;
  team: number | null;
  name: string | null;
  avatar_url: string | null;
  category: string | null;
};

export type OpenMatchRow = {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  gender_category: "masculino" | "femenino" | "mixto" | null;
  categoryRange: string[] | null;
  createdByClub?: boolean;
  court_name: string | null;
  court_surface: string | null;
  category: string | null;
  participants: OpenMatchParticipant[];
};

type Props = {
  club: PartidosClub;
  courts: PartidosCourt[];
  playerCategory: string | null;
  playerGender: string | null;
  openMatches: OpenMatchRow[];
};

type Tab = "abrir" | "unirse";
type Visibility = "publico" | "privado";
type GenderCategory = "masculino" | "femenino" | "mixto";

const CATEGORY_OPTIONS = ["8va", "7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"];

/** Default: categoría del jugador ±1. */
function defaultCategoryRange(playerCategory: string): string[] {
  const idx = CATEGORY_OPTIONS.indexOf(playerCategory);
  if (idx === -1) return [playerCategory];
  return CATEGORY_OPTIONS.slice(Math.max(0, idx - 1), idx + 2);
}

/** No se puede seleccionar una categoría a más de ±2 de la del jugador. */
function isSelectable(cat: string, playerCategory: string): boolean {
  const playerIdx = CATEGORY_OPTIONS.indexOf(playerCategory);
  const catIdx = CATEGORY_OPTIONS.indexOf(cat);
  if (playerIdx === -1 || catIdx === -1) return true;
  return Math.abs(catIdx - playerIdx) <= 2;
}

const GENDER_OPTIONS: { value: GenderCategory; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "femenino", label: "Femenino" },
  { value: "mixto", label: "Mixto" },
];

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

function formatSurface(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Superficie no definida";
  const s = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    cemento: "Cemento",
    cristal: "Cristal",
    "cesped sintetico": "Césped sintético",
    moqueta: "Moqueta",
  };
  return map[s] ?? raw.trim();
}

function formatPrice(n: number): string {
  return `$${new Intl.NumberFormat("es-AR").format(n)}`;
}

function genderLabel(g: "masculino" | "femenino" | "mixto" | null): string {
  return g === "masculino" ? "Masculino" : g === "femenino" ? "Femenino" : "Mixto";
}

type DayChip = { ymd: string; label: string; dateObj: Date };

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
    return { ymd, label, dateObj: d };
  });
}

function Header({ club }: { club: PartidosClub }) {
  const cityProvince = [club.city, club.province]
    .filter((v): v is string => Boolean(v?.trim()))
    .map((v) => v.trim().toUpperCase())
    .join(", ");

  return (
    <>
      <div className="h-0.5 w-full" style={{ backgroundColor: "#CCFF00" }} />
      <div className="mx-auto flex w-full max-w-[480px] items-center gap-3 px-4 py-4">
        <Link
          href={`/${club.slug}`}
          aria-label="Volver"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white"
        >
          ←
        </Link>
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/10">
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div>
          <p className="text-[15px] font-bold text-white">{club.name}</p>
          {cityProvince ? <p className="text-[11px] text-white/60">{cityProvince}</p> : null}
        </div>
      </div>
    </>
  );
}

function PlayerAvatarCircle({ participant }: { participant: OpenMatchParticipant | undefined }) {
  if (!participant) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-xs text-white/40">
        +
      </div>
    );
  }
  const initial = (participant.name?.trim()[0] ?? "J").toUpperCase();
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: "linear-gradient(135deg, #0085FC 0%, #0461C4 100%)" }}
    >
      {initial}
    </div>
  );
}

function OpenMatchCard({ match }: { match: OpenMatchRow }) {
  const dateStr = match.scheduled_date ?? "";
  const fecha =
    dateStr.length >= 10
      ? format(parseISO(`${dateStr}T12:00:00`), "EEE d MMM", { locale: es })
      : "—";
  const hora = (match.scheduled_time ?? "").toString().trim().slice(0, 5);
  const team1 = match.participants.filter((p) => p.team === 1);
  const team2 = match.participants.filter((p) => p.team === 2);
  const freeSlots = Math.max(0, 4 - match.participants.length);
  const isFull = freeSlots === 0;

  return (
    <article className="rounded-2xl border border-[#1A3050] bg-white/[0.04] p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold capitalize text-white">
          {fecha} · {hora || "—"} hs
        </p>
        {match.createdByClub ? (
          <span className="rounded-full bg-[#CCFF00]/15 px-2 py-0.5 text-[10px] font-bold text-[#CCFF00]">
            📍 Publicado por el club
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-white/50">
        {match.court_name ?? "Cancha"} · {formatSurface(match.court_surface)}
      </p>

      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="flex gap-2">
          <PlayerAvatarCircle participant={team1[0]} />
          <PlayerAvatarCircle participant={team1[1]} />
        </div>
        <span className="text-[11px] font-bold text-white/40">VS</span>
        <div className="flex gap-2">
          <PlayerAvatarCircle participant={team2[0]} />
          <PlayerAvatarCircle participant={team2[1]} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {match.categoryRange && match.categoryRange.length > 0 ? (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-white/50">
            {match.categoryRange.join(" · ")}
          </span>
        ) : (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-white/50">
            Cualquier categoría
          </span>
        )}
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/60">
          {genderLabel(match.gender_category)}
        </span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/60">
          {isFull ? "Completo" : `${freeSlots} ${freeSlots === 1 ? "lugar libre" : "lugares libres"}`}
        </span>
      </div>

      <Link
        href={isFull ? "#" : `/partidos/${match.id}`}
        aria-disabled={isFull}
        className={`mt-3 flex h-11 w-full items-center justify-center rounded-2xl text-sm font-bold text-white ${
          isFull ? "pointer-events-none bg-white/[0.06] text-white/30" : "bg-gradient-to-b from-[#0085FC] to-[#0461C4]"
        }`}
      >
        {isFull ? "Partido completo" : "Unirse al partido"}
      </Link>
    </article>
  );
}

export default function PartidosClient({
  club,
  courts,
  playerCategory,
  playerGender,
  openMatches,
}: Props) {
  const router = useRouter();
  const dayChips = useMemo(() => buildDayChips(), []);
  const courtsById = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);

  const [tab, setTab] = useState<Tab>("abrir");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [selectedDate, setSelectedDate] = useState(dayChips[0].ymd);
  const [availability, setAvailability] = useState<{ slots: AvailabilitySlot[]; prices: Record<string, number> }>({
    slots: [],
    prices: {},
  });
  const [isLoadingSlots, startLoadingSlots] = useTransition();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);

  const defaultGender: GenderCategory =
    playerGender === "masculino" || playerGender === "femenino" ? playerGender : "mixto";
  const defaultCategory = playerCategory && CATEGORY_OPTIONS.includes(playerCategory) ? playerCategory : "6ta";

  const [categoryRange, setCategoryRange] = useState<string[]>(() => defaultCategoryRange(defaultCategory));

  function toggleCategory(cat: string) {
    if (!isSelectable(cat, defaultCategory)) return;
    setCategoryRange((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }
  const [genero, setGenero] = useState<GenderCategory>(defaultGender);
  const [visibilidad, setVisibilidad] = useState<Visibility>("publico");

  const [isCreating, startCreating] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    startLoadingSlots(async () => {
      const result = await getClubAvailability(club.id, selectedDate);
      setAvailability(result);
    });
  }, [club.id, selectedDate]);

  function handleSelectDate(ymd: string) {
    setSelectedTime(null);
    setSelectedDate(ymd);
  }

  function priceForCourt(courtId: string, time: string): number | null {
    const override = availability.prices[`${courtId}__${time}`];
    if (override != null) return override;
    const court = courtsById.get(courtId);
    return typeof court?.price === "number" ? court.price : null;
  }

  const selectedDayChip = dayChips.find((d) => d.ymd === selectedDate) ?? dayChips[0];
  const availableCourtIds = selectedTime
    ? availability.slots.find((s) => s.time === selectedTime)?.courtIds ?? []
    : [];
  const selectedCourt = selectedCourtId ? courtsById.get(selectedCourtId) : null;

  function handleCreateMatch() {
    if (!selectedCourtId || !selectedTime) return;
    setCreateError(null);
    startCreating(async () => {
      try {
        const result = await abrirPartido({
          courtId: selectedCourtId,
          clubId: club.id,
          scheduledDate: selectedDate,
          scheduledTime: selectedTime,
          genderCategory: genero,
          categoryRange,
          visibility: visibilidad,
        });
        if ("error" in result) {
          setCreateError(result.error);
          return;
        }
        router.push(`/partidos/${result.matchId}?message=¡Partido abierto! Compartilo para que se sumen.`);
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setCreateError("Hubo un error de conexión. Intentá de nuevo.");
      }
    });
  }

  return (
    <main className={`min-h-dvh ${spaceGrotesk.className}`} style={{ backgroundColor: "#0A1628" }}>
      <Header club={club} />

      <div className="mx-auto w-full max-w-[480px] px-4 pt-4">
        <div className="flex rounded-2xl border border-[#1A3050] bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setTab("abrir")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              tab === "abrir" ? "bg-white/[0.08] text-white shadow-sm" : "text-white/45"
            }`}
          >
            Abrir partido
          </button>
          <button
            type="button"
            onClick={() => setTab("unirse")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              tab === "unirse" ? "bg-white/[0.08] text-white shadow-sm" : "text-white/45"
            }`}
          >
            Unirse {openMatches.length > 0 ? `(${openMatches.length})` : ""}
          </button>
        </div>
      </div>

      {tab === "abrir" ? (
        <div className="mx-auto w-full max-w-[480px] px-4 pb-24 pt-5">
          <div className="mb-5 rounded-xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.03] p-4">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-white/35">Cómo funciona</p>
            <div className="flex flex-col gap-2">
              {[
                { n: "①", text: "Abrís el partido y se publica para que otros se unan" },
                { n: "②", text: "Jugadores 2 y 3 se unen gratis" },
                { n: "③", text: "El 4to jugador paga la seña y confirma la cancha para todos" },
              ].map((item) => (
                <p key={item.n} className="flex gap-2 text-sm text-white/55">
                  <span className="shrink-0 font-mono text-[#CCFF00]">{item.n}</span>
                  <span>{item.text}</span>
                </p>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {step === 1 ? (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-5"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                  Paso 1 de 3 · Cuándo jugás
                </p>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dayChips.map((d) => {
                    const active = d.ymd === selectedDate;
                    const parts = d.label.split(" ");
                    const top = parts.length > 1 ? parts[0] : d.label;
                    const bottom = parts.length > 1 ? parts[1] : null;
                    return (
                      <button
                        key={d.ymd}
                        type="button"
                        onClick={() => handleSelectDate(d.ymd)}
                        className="shrink-0 rounded-xl border px-5 py-2.5 text-center"
                        style={
                          active
                            ? { backgroundColor: "#CCFF00", color: "#0A1628", borderColor: "#CCFF00" }
                            : { borderColor: "#1A3050" }
                        }
                      >
                        {bottom ? (
                          <span className="flex flex-col gap-0.5">
                            <span className={`text-xs ${active ? "font-bold" : "text-white/40"}`}>{top}</span>
                            <span className={`text-sm font-bold ${active ? "" : "text-white/70"}`}>{bottom}</span>
                          </span>
                        ) : (
                          <span className={`text-sm font-semibold ${active ? "" : "text-white/70"}`}>{top}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {isLoadingSlots ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-[52px] animate-pulse rounded-xl bg-white/[0.06]" />
                    ))}
                  </div>
                ) : availability.slots.length === 0 ? (
                  <div className="rounded-xl border border-[#1A3050] bg-white/[0.03] px-4 py-6 text-center">
                    <p className="text-2xl">😴</p>
                    <p className="mt-1 text-sm font-semibold text-white/60">Sin turnos disponibles</p>
                    <p className="mt-1 text-xs text-white/35">Probá con otro día</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availability.slots.map((slot) => {
                      const active = slot.time === selectedTime;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedTime(slot.time)}
                          className="flex items-center justify-center rounded-xl border px-3 py-3 text-center"
                          style={
                            active
                              ? { borderColor: "#CCFF00", borderWidth: 1.5, backgroundColor: "rgba(204,255,0,0.08)" }
                              : { borderColor: "#1A3050", backgroundColor: "rgba(255,255,255,0.06)" }
                          }
                        >
                          <span className="text-[15px] font-bold text-white">{slot.time}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!selectedTime}
                  onClick={() => setStep(2)}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-sm font-bold text-white disabled:opacity-40"
                >
                  Continuar
                </button>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-5"
              >
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 self-start text-sm font-medium text-white/50 transition hover:text-white/80"
                >
                  ← Cambiar horario
                </button>

                <p className="-mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                  Paso 2 de 3 · Dónde jugás
                </p>

                <div className="flex flex-col gap-2">
                  {availableCourtIds.map((courtId) => {
                    const court = courtsById.get(courtId);
                    if (!court) return null;
                    const active = courtId === selectedCourtId;
                    const price = selectedTime ? priceForCourt(courtId, selectedTime) : null;
                    return (
                      <button
                        key={courtId}
                        type="button"
                        onClick={() => setSelectedCourtId(courtId)}
                        className="rounded-2xl border p-4 text-left"
                        style={
                          active
                            ? { borderColor: "#CCFF00", backgroundColor: "rgba(204,255,0,0.08)" }
                            : { borderColor: "#1A3050", backgroundColor: "rgba(255,255,255,0.04)" }
                        }
                      >
                        <p className="text-base font-bold text-white">{court.name ?? "Cancha"}</p>
                        <p className="mt-0.5 text-xs text-white/45">
                          {formatSurface(court.surface)} · {court.indoor ? "🏠 Techada" : "☀️ Descubierta"}
                        </p>
                        {price != null ? (
                          <p className="mt-2 text-sm font-bold text-[#0085FC]">{formatPrice(price)} / turno</p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={!selectedCourtId}
                  onClick={() => setStep(3)}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-sm font-bold text-white disabled:opacity-40"
                >
                  Continuar
                </button>
              </motion.div>
            ) : null}

            {step === 3 ? (
              <motion.div
                key="step3"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-5"
              >
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1 self-start text-sm font-medium text-white/50 transition hover:text-white/80"
                >
                  ← Cambiar cancha
                </button>

                <p className="-mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                  Paso 3 de 3 · Cómo jugás
                </p>

                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                    Categorías permitidas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_OPTIONS.map((cat) => {
                      const active = categoryRange.includes(cat);
                      const selectable = isSelectable(cat, defaultCategory);
                      return (
                        <button
                          key={cat}
                          type="button"
                          disabled={!selectable}
                          onClick={() => toggleCategory(cat)}
                          className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-30"
                          style={
                            active
                              ? { borderColor: "#CCFF00", backgroundColor: "rgba(204,255,0,0.08)", color: "#fff" }
                              : { borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }
                          }
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-white/35">
                    Solo jugadores de estas categorías podrán unirse directamente
                  </p>
                </div>

                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                    Género del partido
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {GENDER_OPTIONS.map((opt) => {
                      const active = opt.value === genero;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGenero(opt.value)}
                          className="rounded-xl border px-2 py-2.5 text-sm font-semibold"
                          style={
                            active
                              ? { borderColor: "#CCFF00", backgroundColor: "rgba(204,255,0,0.10)", color: "#fff" }
                              : { borderColor: "#1A3050", color: "rgba(255,255,255,0.6)" }
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">Visibilidad</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibilidad("publico")}
                      className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left"
                      style={{ borderColor: visibilidad === "publico" ? "#CCFF00" : "#1A3050" }}
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                        style={{ borderColor: visibilidad === "publico" ? "#CCFF00" : "rgba(255,255,255,0.3)" }}
                      >
                        {visibilidad === "publico" ? (
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#CCFF00" }} />
                        ) : null}
                      </span>
                      <span className="text-sm text-white">
                        <span className="font-semibold">Público</span>
                        <span className="text-white/50"> — cualquiera puede unirse</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibilidad("privado")}
                      className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left"
                      style={{ borderColor: visibilidad === "privado" ? "#CCFF00" : "#1A3050" }}
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                        style={{ borderColor: visibilidad === "privado" ? "#CCFF00" : "rgba(255,255,255,0.3)" }}
                      >
                        {visibilidad === "privado" ? (
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#CCFF00" }} />
                        ) : null}
                      </span>
                      <span className="text-sm text-white">
                        <span className="font-semibold">Privado</span>
                        <span className="text-white/50"> — solo tus amigos</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#1A3050] bg-white/[0.04] p-4">
                  <p className="text-sm font-bold text-white">{club.name}</p>
                  <p className="mt-0.5 text-xs text-white/55">
                    {format(selectedDayChip.dateObj, "EEE d MMM", { locale: es })} · {selectedTime} hs ·{" "}
                    {(selectedCourt?.name ?? "Cancha").toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-white/55">
                    {categoryRange.length > 0 ? categoryRange.join(" · ") : "Cualquier categoría"} ·{" "}
                    {genderLabel(genero)} · {visibilidad === "publico" ? "Público" : "Privado"}
                  </p>
                </div>

                {createError ? <p className="text-sm text-red-400">{createError}</p> : null}

                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreateMatch}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white disabled:opacity-60"
                >
                  {isCreating ? "Abriendo partido..." : "Abrir partido"}
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[480px] px-4 pb-24 pt-5">
          {openMatches.length === 0 ? (
            <div className="rounded-2xl border border-[#1A3050] bg-white/[0.03] px-4 py-8 text-center">
              <p className="text-2xl">🎾</p>
              <p className="mt-2 text-sm font-semibold text-white/60">No hay partidos abiertos en este club todavía</p>
              <p className="mt-1 text-xs text-white/35">Sé el primero en abrir uno</p>
              <button
                type="button"
                onClick={() => {
                  setTab("abrir");
                  setStep(1);
                }}
                className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-sm font-bold text-white"
              >
                Abrir partido
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {openMatches.map((match) => (
                <OpenMatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
