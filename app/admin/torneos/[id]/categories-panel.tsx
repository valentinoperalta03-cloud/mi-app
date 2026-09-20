"use client";

import { useState, useTransition } from "react";
import {
  adminBadgeNeutral,
  adminBadgePending,
  adminButtonSecondary,
  adminCTADangerCompact,
  adminCTAPrimary,
  adminCard,
  adminKicker,
} from "@/components/admin/admin-premium";
import { formatLevel } from "@/lib/tournament/v2/categories";
import { evaluateZones, zoneCountOptions } from "@/lib/tournament/v2/zones";
import { playoffSizeOptions } from "@/lib/tournament/v2/playoff";
import { computeCapacity, formatMinutes, zonasLoads } from "@/lib/tournament/v2/capacity";
import type { TournamentFormats } from "@/lib/tournament/v2/types";
import type { CategoryInput } from "@/lib/tournament/v2/category-input";
import { CategoryForm, emptyCategoryInput } from "../category-form";
import { addCategoryAction, deleteCategoryAction, generateZonesAction, updateCategoryAction } from "./categories-actions";
import {
  CategoryCompetitivePanel,
  type KnockoutMatchData,
  type TiebreakMatchData,
  type UiMatchFormat,
  type ZoneMatchData,
  type ZoneStandingsData,
} from "./competitive-panel";

type CategoryData = {
  id: string;
  name: string;
  modality: "caballeros" | "damas" | "mixto" | null;
  category_kind: "open" | "traditional" | "suma";
  levels: number[] | null;
  suma_target: number | null;
  max_pairs: number;
  guaranteed_matches: number | null;
  zones_count: number | null;
  zones_generated_at: string | null;
  price_per_pair: number;
  price_unit: "pair" | "player";
  requires_deposit: boolean;
  deposit_type: "percentage" | "fixed" | null;
  deposit_value: number;
  accepts_mp: boolean;
  accepts_cash: boolean;
  accepts_transfer: boolean;
  approvedCount: number;
  totalCount: number;
  hasMatches: boolean;
  zones: Array<{ name: string; memberCount: number }>;
  qualifiers_generated_at: string | null;
  hasZoneMatches: boolean;
  zoneMatches: ZoneMatchData[];
  standingsByZone: ZoneStandingsData[];
  qualifiedCount: number;
  bracketSizeOptions: number[];
  knockoutMatches: KnockoutMatchData[];
  championName: string | null;
  tiebreakMatches: TiebreakMatchData[];
  pairNames: Record<string, string>;
};

function money(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function categorySummary(c: CategoryData): string {
  if (c.category_kind === "suma") return `Suma ${c.suma_target}`;
  if (c.category_kind === "traditional") return (c.levels ?? []).map(formatLevel).join(", ");
  return "Libre";
}

function paymentMethodsSummary(c: CategoryData): string {
  const methods = [c.accepts_mp && "MP", c.accepts_cash && "Efectivo", c.accepts_transfer && "Transferencia"].filter(Boolean);
  return methods.join(" · ");
}

function toInput(c: CategoryData): CategoryInput {
  return {
    name: c.name,
    modality: c.modality,
    categoryKind: c.category_kind,
    levels: c.levels,
    sumaTarget: c.suma_target,
    maxPairs: c.max_pairs,
    guaranteedMatches: c.guaranteed_matches,
    pricePerPair: c.price_per_pair,
    priceUnit: c.price_unit,
    requiresDeposit: c.requires_deposit,
    depositType: c.deposit_type,
    depositValue: c.deposit_value,
    acceptsMp: c.accepts_mp,
    acceptsCash: c.accepts_cash,
    acceptsTransfer: c.accepts_transfer,
  };
}

const DEFAULT_SLOT_MINUTES = 90;

/**
 * Demanda REAL de la configuración elegida (punto 1 del cierre) — no la
 * recomendada, la que el club efectivamente seleccionó (zoneCount +
 * bracketSize). Reusa zonasLoads/computeCapacity tal cual (mismo motor que
 * el cálculo agregado de la página de detalle).
 */
function DemandPreview({
  sizes,
  bracketSize,
  formats,
  availableSlots,
}: {
  sizes: number[];
  bracketSize: number;
  formats: TournamentFormats;
  availableSlots: number;
}) {
  const plan = computeCapacity(zonasLoads(sizes, bracketSize, formats));
  const availableMinutes = availableSlots * DEFAULT_SLOT_MINUTES;
  const enough = plan.totalMinutes <= availableMinutes;
  return (
    <div className={`mt-3 rounded-xl border p-2 text-[11px] ${enough ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"}`}>
      <p className="font-semibold text-[var(--text-primary)]">
        Esta configuración: {plan.totalMatches} partidos · ~{formatMinutes(plan.totalMinutes)} de cancha
      </p>
      <p className="mt-0.5 text-[var(--text-tertiary)]">
        Disponibilidad del torneo: ~{formatMinutes(availableMinutes)} ({availableSlots} franjas).
      </p>
      {enough ? (
        <p className="mt-0.5 font-semibold text-emerald-700 dark:text-emerald-300">✓ Alcanza.</p>
      ) : (
        <p className="mt-0.5 font-semibold text-amber-700 dark:text-amber-300">
          ⚠ Faltan ~{formatMinutes(plan.totalMinutes - availableMinutes)}.
        </p>
      )}
    </div>
  );
}

function ZonesControl({
  tournamentId,
  category,
  formats,
  availableSlots,
}: {
  tournamentId: string;
  category: CategoryData;
  formats: TournamentFormats;
  availableSlots: number;
}) {
  const [zoneCount, setZoneCount] = useState<number | null>(null);
  const [bracketSize, setBracketSize] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options = zoneCountOptions(category.approvedCount, category.guaranteed_matches ?? 1);
  const already = category.zones.length > 0;

  if (category.approvedCount < 4) {
    return <p className="mt-2 text-xs text-[var(--text-tertiary)]">Necesitás al menos 4 inscriptos confirmados para armar zonas.</p>;
  }

  const evForZoneCount = zoneCount ? evaluateZones(category.approvedCount, zoneCount, category.guaranteed_matches ?? 1) : null;
  const bracketOptions = zoneCount ? playoffSizeOptions(category.approvedCount, zoneCount) : [];

  return (
    <div className="mt-3 rounded-2xl border border-dashed border-[var(--border-subtle)] p-3">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">Zonas · {category.approvedCount} inscriptos confirmados</p>
      {already ? (
        <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
          {category.zones.map((z) => (
            <li key={z.name}>
              Zona {z.name}: {z.memberCount} parejas
            </li>
          ))}
        </ul>
      ) : null}
      {category.hasMatches ? (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Ya hay partidos generados: la distribución de zonas quedó fija.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map(({ zones, evaluation }) => (
              <button
                key={zones}
                type="button"
                onClick={() => {
                  setZoneCount(zones);
                  setBracketSize(null);
                }}
                title={evaluation.ok ? `${evaluation.sizes.join("/")} — ${evaluation.totalMatches} partidos` : evaluation.message}
                disabled={!evaluation.ok}
                className={`rounded-full border px-3 py-1 text-xs disabled:opacity-30 ${zoneCount === zones ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
              >
                {zones} zonas
              </button>
            ))}
          </div>
          {evForZoneCount ? (
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
              {evForZoneCount.ok
                ? `${evForZoneCount.sizes.join(" / ")} parejas por zona · ${evForZoneCount.totalMatches} partidos de zona`
                : evForZoneCount.message}
            </p>
          ) : null}

          {zoneCount && bracketOptions.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Tamaño del cuadro (clasificados)</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {bracketOptions.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBracketSize(size)}
                    className={`rounded-full border px-3 py-1 text-xs ${bracketSize === size ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
                  >
                    Cuadro de {size}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {zoneCount && bracketSize && evForZoneCount?.ok ? (
            <DemandPreview sizes={evForZoneCount.sizes} bracketSize={bracketSize} formats={formats} availableSlots={availableSlots} />
          ) : null}

          {msg ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{msg}</p> : null}
          <button
            type="button"
            disabled={!zoneCount || pending}
            onClick={() => {
              if (!zoneCount) return;
              setMsg(null);
              start(async () => {
                const res = await generateZonesAction(tournamentId, category.id, zoneCount);
                if (!res.ok) setMsg(res.message);
              });
            }}
            className={`${adminCTAPrimary} mt-3 disabled:opacity-50`}
          >
            {pending ? "Generando…" : already ? "Regenerar zonas" : "Generar zonas"}
          </button>
        </>
      )}
    </div>
  );
}

export function TournamentCategoriesPanel({
  tournamentId,
  clubId,
  courts,
  categories,
  editable,
  zoneFormat,
  knockoutFormat,
  finalFormat,
  formats,
  availableSlots,
}: {
  tournamentId: string;
  clubId: string;
  courts: Array<{ id: string; name: string }>;
  categories: CategoryData[];
  editable: boolean;
  zoneFormat: UiMatchFormat;
  knockoutFormat: UiMatchFormat;
  finalFormat: UiMatchFormat;
  /** Formato completo (con slotMinutes) — lo necesita ZonesControl para el cálculo de demanda de la configuración elegida. */
  formats: TournamentFormats;
  availableSlots: number;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className={adminCard}>
      <p className={adminKicker}>Categorías</p>
      <div className="mt-3 space-y-3">
        {categories.map((c) => (
          <div key={c.id} className="rounded-2xl border border-[var(--border-subtle)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {[c.modality, categorySummary(c)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className={adminBadgeNeutral}>
                {c.approvedCount}/{c.max_pairs} confirmados
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
              <span>
                {money(c.price_per_pair)} {c.price_unit === "player" ? "por jugador" : "por pareja"}
              </span>
              <span>{c.requires_deposit ? `Seña: ${c.deposit_type === "percentage" ? `${c.deposit_value}%` : money(c.deposit_value)}` : "Sin seña"}</span>
              <span>{paymentMethodsSummary(c)}</span>
            </div>

            {editable && editingId !== c.id ? (
              <div className="mt-3 flex gap-2">
                <button type="button" className={adminButtonSecondary} onClick={() => setEditingId(c.id)}>
                  Editar
                </button>
                {c.totalCount === 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    className={adminCTADangerCompact}
                    onClick={() => {
                      setError(null);
                      start(async () => {
                        const res = await deleteCategoryAction(tournamentId, c.id);
                        if (!res.ok) setError(res.message);
                      });
                    }}
                  >
                    Borrar
                  </button>
                ) : null}
              </div>
            ) : null}

            {editingId === c.id ? (
              <CategoryForm
                initial={toInput(c)}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(input) => {
                  setError(null);
                  start(async () => {
                    const res = await updateCategoryAction(tournamentId, c.id, input);
                    if (res.ok) setEditingId(null);
                    else setError(res.message);
                  });
                }}
              />
            ) : null}

            <ZonesControl tournamentId={tournamentId} category={c} formats={formats} availableSlots={availableSlots} />

            <CategoryCompetitivePanel
              tournamentId={tournamentId}
              clubId={clubId}
              courts={courts}
              categoryId={c.id}
              zonesCount={c.zones.length}
              hasZoneMatches={c.hasZoneMatches}
              zoneMatches={c.zoneMatches}
              standingsByZone={c.standingsByZone}
              qualifiedCount={c.qualifiedCount}
              qualifiersGeneratedAt={c.qualifiers_generated_at}
              bracketSizeOptions={c.bracketSizeOptions}
              knockoutMatches={c.knockoutMatches}
              championName={c.championName}
              zoneFormat={zoneFormat}
              knockoutFormat={knockoutFormat}
              finalFormat={finalFormat}
              tiebreakMatches={c.tiebreakMatches}
              pairNames={c.pairNames}
            />
          </div>
        ))}

        {categories.length === 0 ? <p className={adminBadgePending}>Este torneo todavía no tiene categorías.</p> : null}
        {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

        {editable && adding ? (
          <CategoryForm
            initial={emptyCategoryInput()}
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(input) => {
              setError(null);
              start(async () => {
                const res = await addCategoryAction(tournamentId, input);
                if (res.ok) setAdding(false);
                else setError(res.message);
              });
            }}
          />
        ) : null}

        {editable && !adding ? (
          <button type="button" className={adminButtonSecondary} onClick={() => setAdding(true)}>
            + Agregar categoría
          </button>
        ) : null}
      </div>
    </section>
  );
}
