"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import AdminPageHeader from "@/components/admin/admin-page-header";
import {
  adminButtonSecondary,
  adminCard,
  adminCTADangerCompact,
  adminCTAPrimary,
  adminEmptyState,
  adminKicker,
  adminPressable,
} from "@/components/admin/admin-premium";
import type { OwnerClub } from "@/lib/admin/owner-context";
import { saveClubHours } from "@/app/admin/config/actions";
import ClubDepositFields from "@/components/admin/club-deposit-fields";
import CourtImageUploader from "./court-image-uploader";
import NewCourtForm from "./new-court-form";
import CourtTimeRangesClient, { type CourtTimeRange } from "./[id]/horarios/court-time-ranges-client";
import CourtPricesClient, { type CourtPriceRow } from "./[id]/horarios/court-prices-client";
import { applyBulkPricesAction } from "./[id]/precios/actions";
import { deleteCourt, updateClubDeposit, updateCourt } from "./actions";

// Slots de 90 en 90 desde el open_time del club hasta 22:30 como máximo.
function generateSlots(openTime: string): string[] {
  const [oh, om] = openTime.split(":").map(Number);
  const startMin = (Number.isNaN(oh) ? 9 : oh) * 60 + (Number.isNaN(om) ? 0 : om);
  const endMin = 22 * 60 + 30;

  const slots: string[] = [];
  for (let cur = startMin; cur <= endMin; cur += 90) {
    const h = Math.floor(cur / 60).toString().padStart(2, "0");
    const m = (cur % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}

function chip(active: boolean) {
  return `rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
    active
      ? "border-[#0085FC]/30 bg-[#0085FC]/10 text-[#0085FC]"
      : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
  }`;
}

export type { CourtTimeRange, CourtPriceRow };

// Debe coincidir con VALID_OPEN en app/admin/config/actions.ts (no exportable
// desde ahí porque es un archivo "use server" — solo puede exportar funciones async).
const VALID_OPEN_OPTIONS = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
] as const;

export type CourtRow = {
  id: string;
  name: string | null;
  price: number | null;
  club_id: string;
  surface?: string | null;
  indoor?: boolean | null;
  image_url?: string | null;
};

/** Resumen de precios de la cancha: rango real (reglas por horario + precio base). */
export type CourtPriceSummary = { label: string; variable: boolean };

type View = "hub" | "canchas" | "horarios" | "precios";

export type CanchasHubClientProps = {
  courts: CourtRow[];
  clubs: OwnerClub[];
  userId: string;
  mainClubId: string;
  clubDepositType: "percentage" | "fixed" | null;
  clubDepositValue: number;
  clubRequiresDeposit: boolean;
  blockedCourtIds: string[];
  priceSummaryByCourt: Array<[string, CourtPriceSummary]>;
  clubOpenTime: string;
  clubCloseTime: string;
  timeRangesByCourt: Array<[string, CourtTimeRange[]]>;
  priceSchedulesByCourt: Array<[string, CourtPriceRow[]]>;
  errorMessage: string;
};

const HUB_CARDS: Array<{ view: Exclude<View, "hub">; icon: string; title: string; description: string; cta: string }> = [
  {
    view: "canchas",
    icon: "🏟️",
    title: "Mis canchas",
    description: "Agregar, editar y configurar cada cancha del club",
    cta: "Gestionar →",
  },
  {
    view: "horarios",
    icon: "🕐",
    title: "Horarios",
    description: "Horario semanal de apertura del club y franjas por cancha",
    cta: "Configurar →",
  },
  {
    view: "precios",
    icon: "💰",
    title: "Precios y seña",
    description: "Precios por horario y configuración de seña para reservas",
    cta: "Configurar →",
  },
];

export default function CanchasHubClient(props: CanchasHubClientProps) {
  const [view, setView] = useState<View>("hub");

  if (view === "hub") {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          kicker="Configuración"
          title="Mis canchas"
          subtitle="Todo lo que necesitás para gestionar tus canchas"
        />
        <div className="rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/[0.04] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">📋 ¿Por dónde empezar?</p>
          <ol className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
            <li>1️⃣ <strong>Mis canchas</strong> — Creá y configurá cada cancha del club</li>
            <li>2️⃣ <strong>Horarios</strong> — Definí el horario semanal del club y de cada cancha</li>
            <li>3️⃣ <strong>Precios y seña</strong> — Configurá los precios por horario y la seña</li>
          </ol>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {HUB_CARDS.map((card) => (
            <button
              key={card.view}
              onClick={() => setView(card.view)}
              className={`${adminCard} ${adminPressable} flex flex-col gap-3 text-left transition hover:-translate-y-0.5`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0085FC]/10">
                <span className="text-2xl">{card.icon}</span>
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)]">{card.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{card.description}</p>
              </div>
              <p className="mt-auto text-sm font-semibold text-[#0085FC]">{card.cta}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === "canchas") {
    return <CanchasView {...props} onBack={() => setView("hub")} />;
  }

  if (view === "horarios") {
    return <HorariosView {...props} onBack={() => setView("hub")} />;
  }

  if (view === "precios") {
    return <PreciosView {...props} onBack={() => setView("hub")} />;
  }

  return <PlaceholderView onBack={() => setView("hub")} />;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
    >
      <ChevronLeft size={16} /> Volver
    </button>
  );
}

function CanchasView({
  courts,
  clubs,
  userId,
  blockedCourtIds,
  priceSummaryByCourt,
  onBack,
}: CanchasHubClientProps & { onBack: () => void }) {
  const priceMap = new Map(priceSummaryByCourt);

  return (
    <div className="flex flex-col gap-6">
      <BackButton onBack={onBack} />
      <AdminPageHeader kicker="Canchas" title="Mis canchas" subtitle="Configurá cada cancha del club" />

      {clubs.length > 0 ? (
        <NewCourtForm clubs={clubs} ownerUserId={userId} />
      ) : (
        <p className={`${adminCard} text-sm font-medium text-amber-800`}>
          Necesitás un club asignado para crear canchas.
        </p>
      )}

      {courts.length === 0 ? (
        <p className={adminEmptyState}>Todavía no tenés canchas. Creá la primera con el formulario de arriba.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {courts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              isBlockedToday={blockedCourtIds.includes(court.id)}
              priceSummary={priceMap.get(court.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CourtCard({
  court,
  isBlockedToday,
  priceSummary,
}: {
  court: CourtRow;
  isBlockedToday: boolean;
  priceSummary: CourtPriceSummary | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={adminCard}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {court.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL pública storage
            <img
              src={court.image_url}
              alt={court.name ?? "Cancha"}
              className="h-12 w-12 rounded-xl object-cover ring-1 ring-[var(--border-subtle)]"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-lg font-bold text-[var(--text-tertiary)]">
              {(court.name ?? "C").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-bold text-[var(--text-primary)]">{court.name ?? "Cancha"}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {priceSummary?.label ?? `$${Number(court.price ?? 0).toLocaleString("es-AR")}`}/turno
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${isBlockedToday ? "bg-rose-500" : "bg-emerald-500"}`} />
              <span className="text-xs text-[var(--text-tertiary)]">
                {isBlockedToday ? "Bloqueada hoy" : "Disponible"}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setEditing((v) => !v)}
          className="rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          {editing ? "Cerrar" : "Editar"}
        </button>
      </div>

      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
        {priceSummary?.variable ? "Precios variables según día y horario" : "Mismo precio en todos los horarios"}
      </p>

      <div className="mt-2 flex gap-2 text-xs text-[var(--text-tertiary)]">
        {court.surface ? <span>{court.surface}</span> : <span>Superficie no definida</span>}
        <span>·</span>
        <span>{court.indoor ? "Techada" : "Descubierta"}</span>
      </div>

      {editing ? <CourtEditForm court={court} /> : null}
    </div>
  );
}

function CourtEditForm({ court }: { court: CourtRow }) {
  return (
    <form action={updateCourt} className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
      <input type="hidden" name="court_id" value={court.id} />

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Nombre</span>
        <input
          name="name"
          required
          defaultValue={court.name ?? ""}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Precio base por turno (ARS)</span>
        <input
          type="number"
          name="price"
          min={0}
          required
          defaultValue={court.price ?? 0}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Superficie</span>
          <select
            name="surface"
            defaultValue={court.surface ?? "cemento"}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="cemento">Cemento</option>
            <option value="cristal">Cristal</option>
            <option value="cesped sintetico">Césped sintético</option>
            <option value="moqueta">Moqueta</option>
          </select>
        </label>
        <label className="flex flex-col justify-end gap-2 text-xs font-semibold text-[var(--text-secondary)]">
          <span className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5 font-medium">
            <input type="checkbox" name="indoor" defaultChecked={Boolean(court.indoor)} className="h-4 w-4 rounded border-[var(--border-subtle)]" />
            Techada
          </span>
        </label>
      </div>

      <CourtImageUploader courtId={court.id} initialUrl={court.image_url ?? ""} label="Imagen de cancha" />

      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" className={adminCTAPrimary}>
          Guardar cambios
        </button>
        <button
          type="submit"
          formAction={deleteCourt}
          name="court_id"
          value={court.id}
          onClick={(e) => {
            if (!window.confirm("¿Eliminar esta cancha?")) e.preventDefault();
          }}
          className={adminCTADangerCompact}
        >
          Eliminar cancha
        </button>
      </div>
    </form>
  );
}

function HorariosView({
  courts,
  mainClubId,
  clubOpenTime,
  clubCloseTime,
  timeRangesByCourt,
  onBack,
}: CanchasHubClientProps & { onBack: () => void }) {
  const [expandedCourt, setExpandedCourt] = useState<string | null>(null);
  const rangesMap = new Map(timeRangesByCourt);

  return (
    <div className="flex flex-col gap-6">
      <BackButton onBack={onBack} />
      <AdminPageHeader
        kicker="Canchas"
        title="Horarios"
        subtitle="Horario semanal regular del club y de cada cancha"
      />

      <div className={adminCard}>
        <p className={adminKicker}>Horario general del club</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Horario de apertura</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Se aplica a todas las canchas que no tengan horario propio configurado.
        </p>

        <form action={saveClubHours} className="mt-4 space-y-3">
          <input type="hidden" name="club_id" value={mainClubId} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Hora de apertura</span>
              <select
                name="open_time"
                defaultValue={VALID_OPEN_OPTIONS.includes(clubOpenTime as (typeof VALID_OPEN_OPTIONS)[number]) ? clubOpenTime : "09:00"}
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {VALID_OPEN_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t} hs
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs text-[var(--text-tertiary)]">El sistema genera turnos de 90 min hasta las 00:00.</p>

          <button type="submit" className={adminCTAPrimary}>
            Guardar horario
          </button>
        </form>
      </div>

      {/* Los cierres excepcionales (días cerrados y bloqueos puntuales) viven en
          /admin/bloqueos. Acá quedan solo los horarios regulares del club. */}
      <div className={`${adminCard} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">¿Un día puntual no abrís?</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Los feriados, cierres por lluvia y bloqueos de un horario suelto se cargan en Bloqueos temporales.
          </p>
        </div>
        <Link href="/admin/bloqueos" className={adminButtonSecondary}>
          Ir a Bloqueos temporales
        </Link>
      </div>

      <div className={adminCard}>
        <p className={adminKicker}>Horarios por cancha</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Horarios específicos por cancha</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Por defecto todas las canchas usan el horario general del club. Podés personalizar el horario de cada
          cancha si es necesario.
        </p>

        {courts.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">Todavía no tenés canchas cargadas.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {courts.map((court) => (
              <div key={court.id}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[var(--text-primary)]">{court.name ?? "Cancha"}</p>
                  <button
                    type="button"
                    onClick={() => setExpandedCourt(expandedCourt === court.id ? null : court.id)}
                    className="text-sm font-semibold text-[#0085FC] hover:underline"
                  >
                    {expandedCourt === court.id ? "Cerrar" : "Personalizar horario"}
                  </button>
                </div>
                {expandedCourt === court.id ? (
                  <div className="mt-3">
                    <CourtTimeRangesClient
                      courtId={court.id}
                      clubOpen={clubOpenTime}
                      clubClose={clubCloseTime}
                      initialRanges={rangesMap.get(court.id) ?? []}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreciosView({
  courts,
  mainClubId,
  clubDepositType,
  clubDepositValue,
  clubRequiresDeposit,
  clubOpenTime,
  clubCloseTime,
  timeRangesByCourt,
  priceSchedulesByCourt,
  onBack,
}: CanchasHubClientProps & { onBack: () => void }) {
  const [expandedPriceCourt, setExpandedPriceCourt] = useState<string | null>(null);
  const [requiresDeposit, setRequiresDeposit] = useState(clubRequiresDeposit);
  const rangesMap = new Map(timeRangesByCourt);
  const pricesMap = new Map(priceSchedulesByCourt);
  const allSlots = generateSlots(clubOpenTime);

  const [bulkCourts, setBulkCourts] = useState<string[]>([]);
  const [bulkDays, setBulkDays] = useState<number[]>([]);
  const [bulkFrom, setBulkFrom] = useState("08:00");
  const [bulkTo, setBulkTo] = useState("17:00");
  const [bulkPrice, setBulkPrice] = useState(0);
  const [bulkPending, setBulkPending] = useState(false);

  function toggleBulkCourt(id: string) {
    setBulkCourts((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }
  function toggleBulkDay(day: number) {
    setBulkDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleApplyBulkPrices() {
    setBulkPending(true);
    const result = await applyBulkPricesAction({
      courtIds: bulkCourts,
      days: bulkDays,
      fromTime: bulkFrom,
      toTime: bulkTo,
      price: bulkPrice,
    });
    setBulkPending(false);
    if (result.ok) {
      alert(`✓ Precios actualizados en ${result.updated} turnos`);
      setBulkCourts([]);
      setBulkDays([]);
    } else {
      alert(result.error ?? "Error al aplicar precios");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackButton onBack={onBack} />
      <AdminPageHeader
        kicker="Canchas"
        title="Precios y seña"
        subtitle="Configurá los precios por horario y la seña para reservas"
      />

      <div className={adminCard}>
        <p className={adminKicker}>Seña para reservas</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Configuración de seña</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Elegí si tus jugadores pagan una seña online para confirmar la reserva, o si confirman directo y pagan el
          total en el club.
        </p>
        <form action={updateClubDeposit} className="mt-4 space-y-3">
          <input type="hidden" name="club_id" value={mainClubId} />
          <input type="hidden" name="requires_deposit" value={requiresDeposit ? "true" : "false"} />

          <div className="flex flex-wrap gap-4 text-sm font-medium text-[var(--text-secondary)]">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="requires_deposit_choice"
                checked={requiresDeposit}
                onChange={() => setRequiresDeposit(true)}
              />
              Solicitar seña
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="requires_deposit_choice"
                checked={!requiresDeposit}
                onChange={() => setRequiresDeposit(false)}
              />
              No solicitar seña
            </label>
          </div>

          {requiresDeposit ? (
            <ClubDepositFields defaultDepositType={clubDepositType} defaultDepositValue={clubDepositValue} />
          ) : (
            <p className="rounded-xl bg-[#0085FC]/5 px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
              Los jugadores confirman la reserva sin pagar online. El precio completo del turno queda a cobrar en el
              club. Mercado Pago sigue siendo obligatorio para habilitar reservas online.
              {clubDepositValue > 0
                ? " Tu configuración de seña anterior queda guardada por si volvés a activarla."
                : null}
            </p>
          )}

          <button type="submit" className={adminCTAPrimary}>
            Guardar
          </button>
        </form>
      </div>

      <div className={adminCard}>
        <p className={adminKicker}>Configuración masiva de precios</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Aplicar precio a múltiples canchas y días</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Seleccioná canchas, días y franja horaria para aplicar un precio de una sola vez.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className={adminKicker}>Canchas</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBulkCourts(courts.map((c) => c.id))}
                className={chip(bulkCourts.length === courts.length && courts.length > 0)}
              >
                Todas las canchas
              </button>
              {courts.map((court) => (
                <button
                  key={court.id}
                  type="button"
                  onClick={() => toggleBulkCourt(court.id)}
                  className={chip(bulkCourts.includes(court.id))}
                >
                  {court.name ?? "Cancha"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={adminKicker}>Días</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBulkDays([0, 1, 2, 3, 4, 5, 6])}
                className={chip(bulkDays.length === 7)}
              >
                Todos los días
              </button>
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((label, i) => (
                <button key={i} type="button" onClick={() => toggleBulkDay(i)} className={chip(bulkDays.includes(i))}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={adminKicker}>Desde</label>
              <select
                value={bulkFrom}
                onChange={(e) => setBulkFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {allSlots.map((s) => (
                  <option key={s} value={s}>
                    {s}hs
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={adminKicker}>Hasta</label>
              <select
                value={bulkTo}
                onChange={(e) => setBulkTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {allSlots.filter((s) => s > bulkFrom).map((s) => (
                  <option key={s} value={s}>
                    {s}hs
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={adminKicker}>Precio por turno (ARS)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={bulkPrice}
              onChange={(e) => setBulkPrice(Number(e.target.value))}
              placeholder="Ej: 15000"
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>

          {bulkCourts.length > 0 && bulkDays.length > 0 && bulkPrice > 0 ? (
            <div className="rounded-xl border border-[#0085FC]/20 bg-[#0085FC]/[0.04] p-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Se van a actualizar los turnos de <strong>{bulkFrom}hs a {bulkTo}hs</strong> en{" "}
                <strong>
                  {bulkCourts.length} cancha{bulkCourts.length !== 1 ? "s" : ""}
                </strong>{" "}
                para{" "}
                <strong>
                  {bulkDays.length} día{bulkDays.length !== 1 ? "s" : ""}
                </strong>{" "}
                con precio <strong>${bulkPrice.toLocaleString("es-AR")}</strong>.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleApplyBulkPrices}
            disabled={bulkCourts.length === 0 || bulkDays.length === 0 || bulkPrice === 0 || bulkPending}
            className={`w-full ${adminCTAPrimary} disabled:opacity-40`}
          >
            {bulkPending ? "Aplicando..." : "✓ Aplicar precios"}
          </button>
        </div>
      </div>

      <div className={adminCard}>
        <p className={adminKicker}>Precios por horario</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Precios por cancha</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Configurá el precio de cada turno según el horario y día de la semana. Si no configurás precios
          específicos, se usa el precio base de la cancha.
        </p>

        {courts.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">Todavía no tenés canchas cargadas.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {courts.map((court) => (
              <div key={court.id} className="border-b border-[var(--border-subtle)] pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{court.name ?? "Cancha"}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                      Precio base: ${Number(court.price ?? 0).toLocaleString("es-AR")}/turno
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedPriceCourt(expandedPriceCourt === court.id ? null : court.id)}
                    className="text-sm font-semibold text-[#0085FC] hover:underline"
                  >
                    {expandedPriceCourt === court.id ? "Cerrar" : "Configurar precios"}
                  </button>
                </div>

                {expandedPriceCourt === court.id ? (
                  <div className="mt-4">
                    <CourtPricesClient
                      courtId={court.id}
                      clubOpen={clubOpenTime}
                      clubClose={clubCloseTime}
                      basePrice={Number(court.price ?? 0)}
                      timeRanges={rangesMap.get(court.id) ?? []}
                      priceRows={pricesMap.get(court.id) ?? []}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <button onClick={onBack} className={adminButtonSecondary}>
        ← Volver
      </button>
      <div className={`${adminCard} text-sm font-medium text-[var(--text-tertiary)]`}>
        Próximamente — sección en construcción
      </div>
    </div>
  );
}
