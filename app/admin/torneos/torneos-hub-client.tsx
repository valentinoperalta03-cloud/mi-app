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

const FLOW_STEPS = [
  {
    step: "01",
    icon: "📋",
    title: "Creás y publicás",
    desc: "Configurás tipo, fecha, precio y categorías. Los jugadores se inscriben y pagan desde la app.",
  },
  {
    step: "02",
    icon: "⚡",
    title: "Generás el fixture",
    desc: "Con un click, la app arma el cuadro automáticamente según las inscripciones recibidas.",
  },
  {
    step: "03",
    icon: "🏆",
    title: "Cargás resultados",
    desc: "Ingresás el resultado de cada partido. El ranking o bracket se actualiza en tiempo real.",
  },
];

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
  courts,
}: {
  clubId: string;
  torneos: TorneoRow[];
  courts: { id: string; name: string }[];
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
        <TorneoFormInline
          clubId={clubId}
          courts={courts}
          onSuccess={() => setView("lista")}
        />
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FLOW_STEPS.map((item) => (
          <div key={item.step} className={`${adminCard} flex flex-col gap-2`}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
                {item.step}
              </span>
              <span className="text-xl">{item.icon}</span>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {item.title}
            </p>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      <AdminGuideBox title="¿Cómo funciona un torneo en PadeLibre?">
        <div>
          <p className="font-bold text-[var(--text-primary)]">El club hace:</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[var(--text-secondary)]">
            <li>Creá el torneo (tipo, fecha, precio, categorías).</li>
            <li>
              Lo publicás → los jugadores se inscriben y pagan desde la app.
            </li>
            <li>Cerrás las inscripciones cuando están completas.</li>
            <li>Generás el fixture automáticamente con un click.</li>
            <li>Cargás los resultados de cada partido.</li>
            <li>El cuadro se actualiza en tiempo real para todos.</li>
          </ol>
        </div>

        <div>
          <p className="font-bold text-[var(--text-primary)]">
            La app hace automáticamente:
          </p>
          <ul className="mt-1.5 space-y-1.5 text-[var(--text-secondary)]">
            <li>Recibe los pagos de inscripción vía Mercado Pago.</li>
            <li>Arma las parejas y el fixture según el tipo de torneo.</li>
            <li>Muestra el cuadro en vivo a todos los jugadores.</li>
            <li>Notifica a cada pareja cuándo y contra quién juegan.</li>
          </ul>
        </div>

        <div>
          <p className="font-bold text-[var(--text-primary)]">
            Por tipo de torneo:
          </p>
          <ul className="mt-1.5 space-y-1.5 text-[var(--text-secondary)]">
            <li>
              <span className="font-semibold">🏆 Americano:</span> todos juegan
              contra todos. Se rankea por puntos al final.
            </li>
            <li>
              <span className="font-semibold">⚡ Eliminación directa:</span>{" "}
              bracket. El que pierde, queda afuera.
            </li>
            <li>
              <span className="font-semibold">🎉 Peña:</span> formato social,
              sin ranking. Ideal con comida y bebida.
            </li>
          </ul>
        </div>
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
