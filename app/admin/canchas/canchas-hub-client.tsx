"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import AdminPageHeader from "@/components/admin/admin-page-header";
import {
  adminButtonSecondary,
  adminCard,
  adminCTADangerCompact,
  adminCTAPrimary,
  adminEmptyState,
  adminPressable,
} from "@/components/admin/admin-premium";
import type { OwnerClub } from "@/lib/admin/owner-context";
import CourtImageUploader from "./court-image-uploader";
import NewCourtForm from "./new-court-form";
import { deleteCourt, updateCourt } from "./actions";

export type CourtRow = {
  id: string;
  name: string | null;
  price: number | null;
  club_id: string;
  surface?: string | null;
  indoor?: boolean | null;
  image_url?: string | null;
};

export type ClosedDayRow = { id: string; closed_date: string; reason: string | null };

export type CourtSlotPrice = { time: string; price: number };

type View = "hub" | "canchas" | "horarios" | "precios";

export type CanchasHubClientProps = {
  courts: CourtRow[];
  clubs: OwnerClub[];
  userId: string;
  mainClubId: string;
  clubDepositType: "percentage" | "fixed" | null;
  clubDepositValue: number;
  blockedCourtIds: string[];
  closedDays: ClosedDayRow[];
  slotPricesByCourt: Array<[string, CourtSlotPrice[]]>;
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
    description: "Horario de apertura del club, días cerrados y franjas por cancha",
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
  slotPricesByCourt,
  onBack,
}: CanchasHubClientProps & { onBack: () => void }) {
  const priceMap = new Map(slotPricesByCourt);

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
              slots={priceMap.get(court.id) ?? []}
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
  slots,
}: {
  court: CourtRow;
  isBlockedToday: boolean;
  slots: CourtSlotPrice[];
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
              ${Number(court.price ?? 0).toLocaleString("es-AR")}/turno
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

      {slots.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {slots.slice(0, 3).map((s) => (
            <span
              key={s.time}
              className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]"
            >
              {s.time}: ${s.price.toLocaleString("es-AR")}
            </span>
          ))}
          {slots.length > 3 ? (
            <span className="text-[11px] text-[var(--text-tertiary)]">+{slots.length - 3} más</span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">Sin precios por horario</p>
      )}

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
