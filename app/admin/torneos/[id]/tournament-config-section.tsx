"use client";

import { useState } from "react";
import {
  adminButtonSecondary,
  adminCard,
  adminKicker,
} from "@/components/admin/admin-premium";
import EditTournamentForm, {
  type EditableTournament,
} from "./edit-tournament-form";

function chipList(items: string[]) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function TournamentConfigSection({
  tournament,
  typeLabel,
  startDateLabel,
  endDateLabel,
  deadlineLabel,
  editable,
}: {
  tournament: EditableTournament;
  typeLabel: string;
  startDateLabel: string;
  endDateLabel: string;
  deadlineLabel: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const isPena = tournament.tournamentType === "pena";

  if (editing) {
    return (
      <div className={adminCard}>
        <p className="mb-4 font-admin-display text-lg font-semibold text-[var(--text-primary)]">
          Editar torneo
        </p>
        <EditTournamentForm
          tournament={tournament}
          onSuccess={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <details className={`${adminCard} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between marker:content-none">
        <p className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
          Configuración del torneo
        </p>
        <span className="text-xs font-semibold text-[#0085FC] group-open:hidden">
          Ver más
        </span>
        <span className="hidden text-xs font-semibold text-[#0085FC] group-open:inline">
          Cerrar
        </span>
      </summary>

      <div className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4 text-sm">
        <div>
          <p className={adminKicker}>Tipo</p>
          <p className="text-[var(--text-secondary)]">{typeLabel}</p>
        </div>
        <div>
          <p className={adminKicker}>Fecha de inicio</p>
          <p className="text-[var(--text-secondary)]">{startDateLabel}</p>
        </div>
        <div>
          <p className={adminKicker}>Fecha de fin</p>
          <p className="text-[var(--text-secondary)]">{endDateLabel}</p>
        </div>
        <div>
          <p className={adminKicker}>Fecha límite de inscripción</p>
          <p className="text-[var(--text-secondary)]">{deadlineLabel}</p>
        </div>

        {!isPena ? (
          <div>
            <p className={adminKicker}>Categorías permitidas</p>
            {tournament.allowedCategories.length > 0 ? (
              chipList(tournament.allowedCategories)
            ) : (
              <p className="text-[var(--text-secondary)]">Todas</p>
            )}
          </div>
        ) : null}

        {tournament.tournamentType === "americano" || isPena ? (
          <div>
            <p className={adminKicker}>Formato de partidos</p>
            <p className="text-[var(--text-secondary)]">
              {tournament.matchFormat === "tiempo"
                ? `Por tiempo (${tournament.matchDurationMinutes ?? "—"} min)`
                : "A un set"}
            </p>
          </div>
        ) : null}

        {tournament.tournamentType === "americano" ? (
          <div>
            <p className={adminKicker}>¿Cómo termina?</p>
            <p className="text-[var(--text-secondary)]">
              {tournament.hasFinals
                ? "🏆 Con final y 3er puesto"
                : "📊 Solo ranking por puntos"}
            </p>
          </div>
        ) : null}

        {tournament.tournamentType === "eliminacion" ? (
          <>
            <div>
              <p className={adminKicker}>Copa de plata</p>
              <p className="text-[var(--text-secondary)]">
                {tournament.consolationBracket ? "🥈 Sí" : "❌ No"}
              </p>
            </div>
            <div>
              <p className={adminKicker}>Duración</p>
              <p className="text-[var(--text-secondary)]">
                {tournament.multiDay ? "📅📅 Varios días" : "📅 Un solo día"}
              </p>
            </div>
          </>
        ) : null}

        {isPena ? (
          <>
            <div>
              <p className={adminKicker}>Cantidad de canchas</p>
              <p className="text-[var(--text-secondary)]">
                {tournament.numCourts ?? "—"}
              </p>
            </div>
            <div>
              <p className={adminKicker}>¿Qué incluye?</p>
              {tournament.whatIncludes.length > 0 || tournament.foodIncluded ? (
                <p className="text-[var(--text-secondary)]">
                  {[...tournament.whatIncludes, tournament.foodIncluded]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : (
                <p className="text-[var(--text-secondary)]">Sin especificar</p>
              )}
            </div>
          </>
        ) : null}

        {editable ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${adminButtonSecondary} mt-2`}
          >
            Editar torneo
          </button>
        ) : null}
      </div>
    </details>
  );
}
