"use client";

import { useState } from "react";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminButtonSecondary, adminCard, adminPressable } from "@/components/admin/admin-premium";
import type { OwnerClub } from "@/lib/admin/owner-context";

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

  return <PlaceholderView onBack={() => setView("hub")} />;
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
