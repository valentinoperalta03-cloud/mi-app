"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Plus, Trophy } from "lucide-react";
import AdminGuideBox from "@/components/admin/admin-guide-box";
import AdminPageHeader from "@/components/admin/admin-page-header";
import {
  adminAccentBar,
  adminBadgeNeutral,
  adminCard,
  adminCTAPrimary,
  adminEmptyState,
} from "@/components/admin/admin-premium";
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_TYPE_OPTIONS,
} from "@/lib/tournament-constants";
import TorneoFormInline from "./torneo-form";

export type TorneoRow = {
  id: string;
  name: string;
  tournamentType: string;
  startDate: string;
  endDate: string;
  status: string;
  maxPairs: number;
  registeredCount: number;
};

type View = "lista" | "nuevo";

function typeLabel(t: string) {
  return TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === t)?.badge ?? t;
}

function TorneoCard({ torneo }: { torneo: TorneoRow }) {
  return (
    <Link
      href={`/admin/torneos/${torneo.id}`}
      className={`${adminCard} flex flex-col gap-1 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between ${torneo.status === "in_progress" ? adminAccentBar : ""}`}
    >
      <div>
        <p className="font-semibold text-[var(--text-primary)]">
          {torneo.name}
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          {typeLabel(torneo.tournamentType)} · {torneo.startDate} →{" "}
          {torneo.endDate}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={adminBadgeNeutral}>
          {TOURNAMENT_STATUS_LABELS[torneo.status] ?? torneo.status}
        </span>
        <span className="text-[var(--text-secondary)]">
          {torneo.registeredCount}/{torneo.maxPairs} parejas
        </span>
      </div>
    </Link>
  );
}

function HubBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mb-2 inline-flex w-fit touch-manipulation items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-all duration-200 hover:scale-[1.02] hover:text-[#0085FC] active:scale-[0.96] md:mb-4 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-sm"
    >
      <ChevronLeft
        size={16}
        strokeWidth={2}
        className="shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:-translate-x-0.5"
      />
      Volver a torneos
    </button>
  );
}

export default function TorneosHubClient({
  clubId,
  torneos,
}: {
  clubId: string;
  torneos: TorneoRow[];
}) {
  const [view, setView] = useState<View>("lista");

  if (view === "nuevo") {
    return (
      <div className="flex flex-col gap-4">
        <HubBackButton onClick={() => setView("lista")} />
        <AdminPageHeader
          kicker="Nuevo torneo"
          title="Crear torneo"
          subtitle="Completá los datos del torneo"
        />
        <TorneoFormInline clubId={clubId} onSuccess={() => setView("lista")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        kicker="Gestión de juego"
        title="Torneos"
        subtitle="Organizá torneos para los jugadores de tu club"
        action={
          <button
            type="button"
            onClick={() => setView("nuevo")}
            className={`inline-flex shrink-0 items-center gap-1.5 ${adminCTAPrimary}`}
          >
            <Plus size={18} />
            Nuevo torneo
          </button>
        }
      />

      <AdminGuideBox title="¿Cómo crear un torneo?">
        <ol className="list-decimal space-y-1.5 pl-4 text-[var(--text-secondary)]">
          <li>
            Creá el torneo con nombre, fecha, precio de inscripción y cantidad
            máxima de parejas.
          </li>
          <li>
            Publicalo para que los jugadores se inscriban desde la app y paguen
            online.
          </li>
          <li>
            Una vez cerradas las inscripciones, generá el fixture
            automáticamente.
          </li>
          <li>
            Cargá los resultados de cada partido para que el cuadro se actualice
            en tiempo real.
          </li>
        </ol>
      </AdminGuideBox>

      {torneos.length === 0 ? (
        <div className={adminEmptyState}>
          <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Todavía no hay torneos.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {torneos.map((torneo) => (
            <TorneoCard key={torneo.id} torneo={torneo} />
          ))}
        </div>
      )}
    </div>
  );
}
