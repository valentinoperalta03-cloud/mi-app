import type { CategoryInput } from "./category-input";

/** Fila lista para insert/update en tournament_categories a partir de un CategoryInput ya validado. */
export type CategoryRow = {
  tournament_id: string;
  name: string;
  modality: string | null;
  category_kind: string;
  levels: number[] | null;
  suma_target: number | null;
  max_pairs: number;
  guaranteed_matches: number | null;
  sort_order: number;
  price_per_pair: number;
  price_unit: string;
  requires_deposit: boolean;
  deposit_type: string | null;
  deposit_value: number;
  accepts_mp: boolean;
  accepts_cash: boolean;
  accepts_transfer: boolean;
};

export function categoryInputToRow(tournamentId: string, input: CategoryInput, sortOrder: number): CategoryRow {
  return {
    tournament_id: tournamentId,
    name: input.name.trim(),
    modality: input.modality,
    category_kind: input.categoryKind,
    levels: input.categoryKind === "traditional" ? (input.levels ?? null) : null,
    suma_target: input.categoryKind === "suma" ? (input.sumaTarget ?? null) : null,
    max_pairs: Math.floor(input.maxPairs),
    guaranteed_matches: input.guaranteedMatches ?? null,
    sort_order: sortOrder,
    price_per_pair: input.pricePerPair,
    price_unit: input.priceUnit,
    requires_deposit: input.requiresDeposit,
    deposit_type: input.requiresDeposit ? (input.depositType ?? null) : null,
    deposit_value: input.requiresDeposit ? Number(input.depositValue ?? 0) : 0,
    accepts_mp: input.acceptsMp,
    accepts_cash: input.acceptsCash,
    accepts_transfer: input.acceptsTransfer,
  };
}
