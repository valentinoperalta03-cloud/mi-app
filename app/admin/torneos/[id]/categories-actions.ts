"use server";

import { revalidatePath } from "next/cache";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import {
  structuralFieldsChanged,
  validateCategoryInput,
  validateMaxPairsChange,
  type CategoryInput,
} from "@/lib/tournament/v2/category-input";
import { categoryInputToRow } from "@/lib/tournament/v2/category-row";
import { createClient, createServiceClient } from "@/utils/supabase/server";

type ActionResult = { ok: boolean; message: string };
type GenerateZonesResult =
  | { ok: true; zonesCreated: number; registrationsPlaced: number; zoneSizes: number[] }
  | { ok: false; message: string };

/** Inscripciones que "ocupan lugar" hoy — mismo criterio que usa tournament_register_entry para el cupo. */
const LIVE_PAYMENT_STATUSES = ["pending_payment", "pending", "approved"] as const;

const GENERATE_ZONES_REASON_MESSAGES: Record<string, string> = {
  invalid_zone_count: "Elegí una cantidad de zonas válida.",
  category_not_found: "Categoría no encontrada.",
  forbidden: "No autorizado.",
  matches_exist: "Ya se generaron partidos para esta categoría: no se puede rehacer la distribución de zonas.",
  not_enough_registrations: "No hay suficientes inscriptos confirmados para esa cantidad de zonas.",
};

/** Torneo dueño de una categoría, verificado contra el club del admin logueado. */
async function assertCategoryOwner(tournamentIdHint: string, categoryId: string) {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false as const, message: "Sesión requerida." };

  const { data: cat } = await supabase
    .from(DB_TABLES.tournamentCategories)
    .select("id, tournament_id")
    .eq("id", categoryId)
    .maybeSingle();
  const catRow = cat as { id: string; tournament_id: string } | null;
  if (!catRow || catRow.tournament_id !== tournamentIdHint) {
    return { ok: false as const, message: "Categoría no encontrada." };
  }

  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select("id, club_id, status")
    .eq("id", catRow.tournament_id)
    .maybeSingle();
  const tRow = t as { id: string; club_id: string; status: string } | null;
  if (!tRow || !ctx.clubIds.includes(tRow.club_id)) {
    return { ok: false as const, message: "No autorizado." };
  }
  return { ok: true as const, tournamentId: tRow.id, tournamentStatus: tRow.status };
}

async function assertTournamentOwnerForCategories(tournamentId: string) {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false as const, message: "Sesión requerida." };
  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select("id, club_id, status")
    .eq("id", tournamentId)
    .maybeSingle();
  const tRow = t as { id: string; club_id: string; status: string } | null;
  if (!tRow || !ctx.clubIds.includes(tRow.club_id)) {
    return { ok: false as const, message: "No autorizado." };
  }
  return { ok: true as const, tournamentStatus: tRow.status };
}

/** Agrega una categoría a un torneo existente — solo mientras la inscripción está abierta. */
export async function addCategoryAction(tournamentId: string, input: CategoryInput): Promise<ActionResult> {
  const gate = await assertTournamentOwnerForCategories(tournamentId);
  if (!gate.ok) return gate;
  if (gate.tournamentStatus !== "open" && gate.tournamentStatus !== "draft") {
    return { ok: false, message: "Solo se pueden agregar categorías mientras la inscripción está abierta." };
  }
  const check = validateCategoryInput(input);
  if (!check.ok) return check;

  const service = createServiceClient();
  const { count } = await service
    .from(DB_TABLES.tournamentCategories)
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const { error } = await service
    .from(DB_TABLES.tournamentCategories)
    .insert(categoryInputToRow(tournamentId, input, count ?? 0));
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? `Ya existe una categoría llamada "${input.name}".` : error.message,
    };
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Categoría agregada." };
}

/**
 * Edita una categoría existente. Dos grupos de campos, con reglas distintas:
 *
 * A) Estructura competitiva (modalidad, tipo, niveles, suma): si la categoría
 *    ya tiene alguna inscripción viva, se bloquea — cambiarla podría dejar
 *    inscriptos que ya no cumplen la regla nueva. Reforzado también por el
 *    trigger tournament_categories_guard_structural_edit (defensa en
 *    profundidad: ninguna otra vía de escritura lo puede saltear).
 * B) Config comercial (precio, seña, métodos de pago): siempre editable.
 *    Aplica solo HACIA ADELANTE — tournament_registrations ya guarda su
 *    propio total_price/requires_deposit del momento en que se inscribió (lo
 *    que devolvió tournament_register_entry), así que no hay nada que
 *    recalcular acá ni riesgo de tocar filas existentes.
 *
 * max_pairs se puede subir siempre; bajarlo está limitado a no dejar menos
 * cupo que inscripciones vivas actuales (mismo criterio LIVE_PAYMENT_STATUSES
 * que usa el cupo de tournament_register_entry).
 */
export async function updateCategoryAction(tournamentId: string, categoryId: string, input: CategoryInput): Promise<ActionResult> {
  const gate = await assertCategoryOwner(tournamentId, categoryId);
  if (!gate.ok) return gate;
  if (gate.tournamentStatus !== "open" && gate.tournamentStatus !== "draft") {
    return { ok: false, message: "Solo se pueden editar categorías mientras la inscripción está abierta." };
  }
  const check = validateCategoryInput(input);
  if (!check.ok) return check;

  const service = createServiceClient();
  const { data: current } = await service
    .from(DB_TABLES.tournamentCategories)
    .select("modality, category_kind, levels, suma_target")
    .eq("id", categoryId)
    .maybeSingle();
  const currentRow = current as {
    modality: "caballeros" | "damas" | "mixto" | null;
    category_kind: "open" | "traditional" | "suma";
    levels: number[] | null;
    suma_target: number | null;
  } | null;

  const { count: liveCount } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .in("payment_status", LIVE_PAYMENT_STATUSES as unknown as string[]);
  const live = liveCount ?? 0;

  if (
    live > 0 &&
    currentRow &&
    structuralFieldsChanged(
      { modality: currentRow.modality, categoryKind: currentRow.category_kind, levels: currentRow.levels, sumaTarget: currentRow.suma_target },
      { modality: input.modality, categoryKind: input.categoryKind, levels: input.levels ?? null, sumaTarget: input.sumaTarget ?? null },
    )
  ) {
    return {
      ok: false,
      message: `Esta categoría ya tiene ${live} inscripción${live === 1 ? "" : "es"}: no se puede cambiar modalidad, tipo, niveles ni suma.`,
    };
  }

  const maxPairsCheck = validateMaxPairsChange(input.maxPairs, live);
  if (!maxPairsCheck.ok) return maxPairsCheck;

  const row = categoryInputToRow(tournamentId, input, 0);
  const { tournament_id: _tid, sort_order: _so, ...patch } = row;
  void _tid;
  void _so;
  const { error } = await service.from(DB_TABLES.tournamentCategories).update(patch).eq("id", categoryId);
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? `Ya existe una categoría llamada "${input.name}".` : error.message,
    };
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Categoría actualizada." };
}

/**
 * Borra una categoría. Si ya tiene inscripciones, el FK de
 * tournament_registrations.category_id (sin ON DELETE) rechaza el borrado —
 * se traduce a un mensaje legible en vez de "eliminar antes" ser una regla
 * de app que se pueda saltear con otra vía de escritura.
 */
export async function deleteCategoryAction(tournamentId: string, categoryId: string): Promise<ActionResult> {
  const gate = await assertCategoryOwner(tournamentId, categoryId);
  if (!gate.ok) return gate;
  if (gate.tournamentStatus !== "open" && gate.tournamentStatus !== "draft") {
    return { ok: false, message: "Solo se pueden borrar categorías mientras la inscripción está abierta." };
  }

  const service = createServiceClient();
  const { error } = await service.from(DB_TABLES.tournamentCategories).delete().eq("id", categoryId);
  if (error) {
    return {
      ok: false,
      message: error.code === "23503" ? "Esta categoría ya tiene inscriptos: no se puede borrar." : error.message,
    };
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Categoría borrada." };
}

/**
 * Genera (o regenera, si todavía no hay partidos) las zonas de una categoría.
 * Llama a la RPC tournament_generate_zones con el cliente del usuario: el
 * ownership se valida DENTRO de la RPC (auth.uid() contra clubs.owner_id),
 * no acá — mismo patrón que tournament_register_entry.
 */
export async function generateZonesAction(tournamentId: string, categoryId: string, zoneCount: number): Promise<GenerateZonesResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const { data: rows, error } = await supabase.rpc("tournament_generate_zones", {
    p_category_id: categoryId,
    p_zone_count: zoneCount,
  });
  if (error) return { ok: false, message: "No se pudieron generar las zonas." };
  const res = (Array.isArray(rows) ? rows[0] : rows) as
    | { ok: boolean; reason: string; zones_created: number; registrations_placed: number; zone_sizes: number[] | null }
    | null;
  if (!res?.ok) {
    return { ok: false, message: GENERATE_ZONES_REASON_MESSAGES[res?.reason ?? ""] ?? "No se pudieron generar las zonas." };
  }
  revalidatePath(`/admin/torneos/${tournamentId}`);
  return {
    ok: true,
    zonesCreated: res.zones_created,
    registrationsPlaced: res.registrations_placed,
    zoneSizes: res.zone_sizes ?? [],
  };
}
