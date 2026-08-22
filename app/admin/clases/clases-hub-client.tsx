"use client";

import Link from "next/link";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  GraduationCap,
  Plus,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/admin-page-header";
import {
  adminAccentBar,
  adminButtonOutlineBrand,
  adminCard,
  adminCTADangerCompact,
  adminCTAPrimary,
  adminEmptyState,
  adminPressable,
} from "@/components/admin/admin-premium";
import type { CourtTimeRangeInput } from "@/lib/court-slots";
import { PRACTICE_STATUS_LABELS } from "@/lib/practice-constants";
import {
  deactivateTrainingBlockAction,
  deleteExternalTrainingBlockRowAction,
} from "./actions";
import ClasePublicaInline from "./clase-publica-modal";
import TrainingWizard from "./training-wizard-client";

type Court = { id: string; name: string };
type Coach = { id: string; name: string };

export type ProfessorSchedule = {
  trainingBlockId: string;
  scheduleLabel: string;
  courtName: string;
  modality: string | null;
};
export type ProfessorGroup = {
  key: string;
  professorName: string;
  schedules: ProfessorSchedule[];
};

export type PunctualTrainingItem = {
  key: string;
  title: string;
  courtName: string;
  scheduleLabel: string;
  courtBlockId: string;
};

export type PracticeRow = {
  id: string;
  title: string;
  status: string;
  recurrence_type: string;
  start_date: string;
  end_date: string;
  max_spots: number;
  price_base: number;
  sessionCount: number;
};

type View = "hub" | "entrenamientos" | "clases";

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
      Volver
    </button>
  );
}

export default function ClasesHubClient({
  clubId,
  courtOptions,
  coachOptions,
  courtTimeRanges,
  clubOpen,
  clubClose,
  professorGroups,
  punctualItems,
  practices,
}: {
  clubId: string;
  courtOptions: Court[];
  coachOptions: Coach[];
  courtTimeRanges: CourtTimeRangeInput[];
  clubOpen: string;
  clubClose: string;
  professorGroups: ProfessorGroup[];
  punctualItems: PunctualTrainingItem[];
  practices: PracticeRow[];
}) {
  const [view, setView] = useState<View>("hub");
  const [showWizard, setShowWizard] = useState(false);
  const [showClaseForm, setShowClaseForm] = useState(false);

  if (view === "entrenamientos") {
    return (
      <div className="flex flex-col gap-6">
        <HubBackButton
          onClick={() => {
            setShowWizard(false);
            setShowClaseForm(false);
            setView("hub");
          }}
        />
        <AdminPageHeader
          kicker="Gestión de juego"
          title="Entrenamientos externos"
          subtitle="Profesores particulares que usan tus canchas"
          action={
            showWizard ? null : (
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className={`inline-flex shrink-0 items-center gap-1.5 ${adminButtonOutlineBrand}`}
              >
                <Plus size={16} />
                Registrar entrenamiento externo
              </button>
            )
          }
        />

        {showWizard ? (
          <TrainingWizard
            courts={courtOptions}
            timeRanges={courtTimeRanges}
            clubOpen={clubOpen}
            clubClose={clubClose}
            onClose={() => setShowWizard(false)}
          />
        ) : (
          <ul className="space-y-2">
            {professorGroups.length === 0 && punctualItems.length === 0 ? (
              <li className={adminEmptyState}>
                Todavía no registraste entrenamientos externos.
              </li>
            ) : null}
            {professorGroups.map((group) => (
              <li key={group.key} className={adminCard}>
                <p className="font-semibold text-[var(--text-primary)]">
                  {group.professorName}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {group.schedules.map((s) => (
                    <li
                      key={s.trainingBlockId}
                      className="flex items-center justify-between gap-3 text-xs text-[var(--text-tertiary)]"
                    >
                      <span>
                        {s.scheduleLabel} · {s.courtName}
                        {s.modality ? ` · ${s.modality}` : ""}
                      </span>
                      <form action={deactivateTrainingBlockAction}>
                        <input
                          type="hidden"
                          name="training_block_id"
                          value={s.trainingBlockId}
                        />
                        <button type="submit" className={adminCTADangerCompact}>
                          Desactivar
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {punctualItems.map((item) => (
              <li
                key={item.key}
                className={`${adminCard} flex items-start justify-between gap-3`}
              >
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {item.courtName} · {item.scheduleLabel}
                  </p>
                </div>
                <form action={deleteExternalTrainingBlockRowAction}>
                  <input
                    type="hidden"
                    name="court_block_id"
                    value={item.courtBlockId}
                  />
                  <button type="submit" className={adminCTADangerCompact}>
                    Dar de baja
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (view === "clases") {
    return (
      <div className="flex flex-col gap-6">
        <HubBackButton
          onClick={() => {
            setShowWizard(false);
            setShowClaseForm(false);
            setView("hub");
          }}
        />
        <AdminPageHeader
          kicker="Gestión de juego"
          title="Clases públicas"
          subtitle="Clases que los jugadores se inscriben y pagan desde la app"
          action={
            showClaseForm ? null : (
              <button
                type="button"
                onClick={() => setShowClaseForm(true)}
                className={`inline-flex shrink-0 items-center gap-1.5 ${adminCTAPrimary}`}
              >
                <Plus size={16} />
                Publicar clase
              </button>
            )
          }
        />

        {showClaseForm ? (
          <ClasePublicaInline
            clubId={clubId}
            courts={courtOptions}
            coaches={coachOptions}
            onClose={() => setShowClaseForm(false)}
          />
        ) : (
          <ul className="space-y-2">
            {practices.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Todavía no hay clases.
              </li>
            ) : null}
            {practices.map((p) => {
              const dateLabel =
                p.recurrence_type === "weekly"
                  ? `${format(parseISO(p.start_date), "d MMM", { locale: es })} – ${format(parseISO(p.end_date), "d MMM yyyy", { locale: es })}`
                  : format(parseISO(p.start_date), "d MMM yyyy", {
                      locale: es,
                    });
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/clases/${p.id}`}
                    className={`block ${adminCard} hover:-translate-y-0.5 ${p.status === "open" ? adminAccentBar : ""}`}
                  >
                    <p className="font-semibold text-[var(--text-primary)]">
                      {p.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {PRACTICE_STATUS_LABELS[p.status] ?? p.status} ·{" "}
                      {dateLabel}
                      {p.sessionCount > 0
                        ? ` · ${p.sessionCount} fecha(s)`
                        : ""}{" "}
                      · {p.max_spots} cupos · $
                      {Number(p.price_base).toLocaleString("es-AR")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        kicker="Gestión de juego"
        title="Clases y entrenamientos"
        subtitle="Elegí qué querés gestionar"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setView("entrenamientos")}
          className={`${adminCard} ${adminPressable} flex flex-col gap-4 text-left transition hover:-translate-y-0.5`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0085FC]/10">
            <Dumbbell size={24} className="text-[#0085FC]" />
          </div>
          <div>
            <p className="text-base font-bold text-[var(--text-primary)]">
              Entrenamientos externos
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              Profesores particulares que usan tus canchas. Bloquean el horario
              automáticamente. Los jugadores NO los ven en la app.
            </p>
          </div>
          <div className="flex items-center gap-1 text-sm font-semibold text-[#0085FC]">
            Gestionar <ChevronRight size={16} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setView("clases")}
          className={`${adminCard} ${adminPressable} flex flex-col gap-4 text-left transition hover:-translate-y-0.5`}
          style={{ borderLeft: "3px solid #CCFF00" }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CCFF00]/10">
            <GraduationCap size={24} className="text-[#CCFF00]" />
          </div>
          <div>
            <p className="text-base font-bold text-[var(--text-primary)]">
              Clases públicas
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              Clases que publicás para que los jugadores se inscriban y paguen
              desde la app. Tienen precio, cupos y horarios visibles.
            </p>
          </div>
          <div className="flex items-center gap-1 text-sm font-semibold text-[#CCFF00]">
            Gestionar <ChevronRight size={16} />
          </div>
        </button>
      </div>
    </div>
  );
}
