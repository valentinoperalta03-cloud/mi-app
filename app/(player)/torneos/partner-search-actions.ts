"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { categoryToTournamentLevel } from "@/lib/tournament-utils";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import { beginTournamentCheckoutAction, registerTournamentOfflineAction } from "./actions";

type ActionResult = { ok: boolean; message: string };

/**
 * Sección 14 del prompt maestro: "busco compañero/a". No ocupa cupo ni crea
 * inscripción hasta que otro jugador acepta — la tabla tournament_partner_requests
 * (Fase A del backend V2) ya existe, esto es la UI + acciones que faltaban.
 */
export async function createPartnerRequestAction(
  tournamentId: string,
  categoryId: string,
  position: "drive" | "reves" | "indistinto",
): Promise<ActionResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const { data: cat } = await supabase
    .from(DB_TABLES.tournamentCategories)
    .select("id, tournament_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!cat || (cat as { tournament_id: string }).tournament_id !== tournamentId) {
    return { ok: false, message: "Categoría no encontrada." };
  }

  const { data: prof } = await supabase.from(DB_TABLES.profiles).select("category, gender").eq("user_id", user.id).maybeSingle();
  const level = categoryToTournamentLevel((prof as { category?: string | null } | null)?.category ?? null);
  const gender = (prof as { gender?: string | null } | null)?.gender ?? null;

  // Ya inscripto (en pareja) en esta categoría: no tiene sentido buscar compañero.
  const { data: existingReg } = await supabase
    .from(DB_TABLES.tournamentRegistrations)
    .select("id")
    .eq("category_id", categoryId)
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .neq("payment_status", "cancelled")
    .neq("payment_status", "expired")
    .maybeSingle();
  if (existingReg) return { ok: false, message: "Ya estás inscripto en esta categoría." };

  const service = createServiceClient();
  const { error } = await service.from(DB_TABLES.tournamentPartnerRequests).insert({
    tournament_id: tournamentId,
    category_id: categoryId,
    player_id: user.id,
    player_level: level,
    player_gender: gender,
    position,
    status: "seeking",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Ya estás buscando compañero/a en esta categoría." };
    return { ok: false, message: "No se pudo publicar la búsqueda." };
  }

  revalidatePath(`/torneos/${tournamentId}`);
  return { ok: true, message: "Publicado. Otros jugadores ya pueden verte en \"Busco pareja\"." };
}

export async function withdrawPartnerRequestAction(tournamentId: string, requestId: string): Promise<ActionResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const service = createServiceClient();
  const { data, error } = await service
    .from(DB_TABLES.tournamentPartnerRequests)
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("player_id", user.id)
    .eq("status", "seeking")
    .select("id");
  if (error) return { ok: false, message: "No se pudo retirar la búsqueda." };
  if (!data?.length) return { ok: false, message: "Esa búsqueda ya no está activa." };

  revalidatePath(`/torneos/${tournamentId}`);
  return { ok: true, message: "Búsqueda retirada." };
}

/**
 * Otro jugador acepta la propuesta: se reusa exactamente el mismo camino de
 * inscripción directa en pareja (tournament_register_entry vía
 * beginTournamentCheckoutAction/registerTournamentOfflineAction), con el
 * jugador que buscaba compañero como partner_user_id. La propia unicidad de
 * tournament_register_entry (un jugador no puede quedar en dos inscripciones
 * vivas de la misma categoría) es lo que evita que dos usuarios acepten la
 * misma propuesta a la vez: el segundo intento falla con
 * "partner_already_registered" aunque las dos peticiones lleguen juntas.
 */
export async function acceptPartnerRequestAction(
  tournamentId: string,
  requestId: string,
  paymentMethod: "mp" | "cash" | "transfer",
): Promise<{ ok: boolean; message: string; url?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const service = createServiceClient();
  const { data: reqRow } = await service
    .from(DB_TABLES.tournamentPartnerRequests)
    .select("id, tournament_id, category_id, player_id, status")
    .eq("id", requestId)
    .maybeSingle();
  const req = reqRow as { id: string; tournament_id: string; category_id: string; player_id: string; status: string } | null;
  if (!req || req.tournament_id !== tournamentId) return { ok: false, message: "Propuesta no encontrada." };
  if (req.status !== "seeking") return { ok: false, message: "Esa propuesta ya fue tomada o retirada." };
  if (req.player_id === user.id) return { ok: false, message: "No podés aceptar tu propia búsqueda." };

  const fd = new FormData();
  fd.set("tournament_id", tournamentId);
  fd.set("partner_user_id", req.player_id);
  fd.set("category_id", req.category_id);

  const result =
    paymentMethod === "mp"
      ? await beginTournamentCheckoutAction(fd)
      : await (async () => {
          fd.set("payment_method", paymentMethod);
          return registerTournamentOfflineAction(fd);
        })();
  if (!result.ok) return result;

  // La inscripción ya existe (o está pendiente de pago): la propuesta queda
  // resuelta. Si dos usuarios llegaron acá casi a la vez, el segundo ya
  // habría fallado arriba con "partner_already_registered".
  const { data: newReg } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("category_id", req.category_id)
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newReg) {
    await service
      .from(DB_TABLES.tournamentPartnerRequests)
      .update({ status: "matched", registration_id: (newReg as { id: string }).id, updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("status", "seeking");
  }

  revalidatePath(`/torneos/${tournamentId}`);
  return result;
}
