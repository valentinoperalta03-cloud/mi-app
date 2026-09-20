"use server";

import { revalidatePath } from "next/cache";
import { calculateDepositAmount } from "@/lib/deposit-utils";
import { DB_TABLES } from "@/lib/db-tables";
import { createTournamentMercadoPagoPreference } from "@/lib/mp-tournament-preference";
import { isClubSubscriptionBlocked } from "@/lib/subscription-check";
import { createClient, createServiceClient } from "@/utils/supabase/server";

type PaymentMethod = "mp" | "cash" | "transfer";

type TournamentForRegistration = {
  name: string;
  club_id: string;
};

type PrepareResult =
  | { ok: false; message: string }
  | {
      ok: true;
      userId: string;
      userEmail: string | null;
      registrationId: string;
      tournamentId: string;
      /** Precio TOTAL de la pareja ya calculado por la RPC a partir de la categoría (respeta price_unit: por pareja o por jugador). */
      totalPrice: number;
      /** Config de seña de la categoría de esta inscripción — nunca de `tournaments`. */
      requiresDeposit: boolean;
      depositType: "percentage" | "fixed" | null;
      depositValue: number;
      tour: TournamentForRegistration;
      clubName: string;
    };

type RegisterEntryRow = {
  ok: boolean;
  reason: string;
  registration_id: string | null;
  total_price: number | null;
  reused: boolean;
  requires_deposit: boolean | null;
  deposit_type: "percentage" | "fixed" | null;
  deposit_value: number | null;
};

const REGISTER_REASON_MESSAGES: Record<string, string> = {
  auth_required: "Iniciá sesión.",
  invalid_payment_method: "Método de pago inválido.",
  tournament_not_found: "Torneo no encontrado.",
  registration_not_open: "Las inscripciones no están abiertas.",
  deadline_passed: "Cerró la fecha límite de inscripción.",
  payment_method_not_accepted: "Este torneo no acepta ese método de pago.",
  individual_only: "En una peña la inscripción es individual.",
  partner_required: "Elegí a tu compañero/a.",
  partner_is_self: "Elegí otro jugador como compañero/a.",
  partner_not_found: "No encontramos a tu compañero/a.",
  category_not_allowed: "Tu categoría no está habilitada para este torneo.",
  partner_category_not_allowed: "La categoría de tu compañero/a no está habilitada para este torneo.",
  category_required: "Elegí una categoría.",
  category_not_found: "Categoría no encontrada.",
  already_registered: "Ya estás inscripto en esta categoría.",
  pending_as_partner: "Ya figurás como compañero/a en una inscripción pendiente de esta categoría.",
  payment_in_progress: "Tu inscripción ya tiene un pago en curso.",
  partner_already_registered: "Tu compañero/a ya está inscripto en esta categoría.",
  tournament_full: "Categoría completa.",
  // Red de seguridad ante dos inscripciones concurrentes para el mismo
  // jugador y categoría: en el camino normal esto lo ataja already_registered
  // o partner_already_registered antes de llegar acá.
  category_player_conflict: "Alguno de los dos ya quedó anotado en esta categoría justo ahora. Volvé a intentar.",
};

/**
 * Crea (o reutiliza) la inscripción vía la RPC atómica
 * tournament_register_entry: valida estado, fecha límite, método de pago,
 * categorías, duplicados y cupo bajo lock del torneo, y define el estado
 * financiero inicial en la base. Los clientes no tienen permisos de escritura
 * sobre tournament_registrations.
 */
async function prepareTournamentRegistration(formData: FormData, method: PaymentMethod): Promise<PrepareResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  const partnerId = String(formData.get("partner_user_id") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  if (!tournamentId) return { ok: false, message: "Torneo inválido." };

  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select("id, club_id, name")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t) return { ok: false, message: "Torneo no encontrado." };
  const tour = t as TournamentForRegistration;

  if (await isClubSubscriptionBlocked(tour.club_id)) {
    return { ok: false, message: "Este club no puede recibir inscripciones en este momento." };
  }

  const { data: rpcRows, error: rpcErr } = await supabase.rpc("tournament_register_entry", {
    p_tournament_id: tournamentId,
    p_partner_id: partnerId || null,
    p_payment_method: method,
    p_category_id: categoryId || null,
  });
  if (rpcErr) return { ok: false, message: "No se pudo crear la inscripción." };
  const res = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as RegisterEntryRow | null;
  if (!res?.ok || !res.registration_id || res.total_price == null) {
    return { ok: false, message: REGISTER_REASON_MESSAGES[res?.reason ?? ""] ?? "No se pudo crear la inscripción." };
  }

  const { data: club } = await supabase.from(DB_TABLES.clubs).select("name").eq("id", tour.club_id).maybeSingle();
  const clubName = String((club as { name?: string | null } | null)?.name ?? "Club");

  return {
    ok: true,
    userId: user.id,
    userEmail: user.email ?? null,
    registrationId: res.registration_id,
    tournamentId,
    totalPrice: Number(res.total_price),
    requiresDeposit: Boolean(res.requires_deposit),
    depositType: res.deposit_type,
    depositValue: Number(res.deposit_value ?? 0),
    tour,
    clubName,
  };
}

export async function beginTournamentCheckoutAction(formData: FormData): Promise<{ ok: boolean; message: string; url?: string }> {
  const prep = await prepareTournamentRegistration(formData, "mp");
  if (!prep.ok) return prep;
  const { userId, userEmail, registrationId, tournamentId, totalPrice, requiresDeposit, depositType, depositValue, tour, clubName } = prep;

  // El total y la seña salen de la CATEGORÍA de esta inscripción (la RPC ya
  // los devolvió resueltos) — nunca de un precio recalculado desde `tournaments`.
  const chargeAmount = requiresDeposit ? calculateDepositAmount(totalPrice, depositType ?? "fixed", depositValue) : totalPrice;

  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const pref = await createTournamentMercadoPagoPreference({
    tournamentId,
    registrationId,
    payerUserId: userId,
    clubName,
    tournamentName: tour.name,
    clubPricePerPair: chargeAmount,
    payerEmail: userEmail ?? undefined,
    backUrls: {
      success: `${base}/torneos/${tournamentId}?pay=ok`,
      failure: `${base}/torneos/${tournamentId}?pay=fail`,
      pending: `${base}/torneos/${tournamentId}?pay=pending`,
    },
  });
  // Si MP falla la inscripción queda pendiente y sin pagar: un reintento la reutiliza.
  if ("error" in pref) return { ok: false, message: pref.error };

  const service = createServiceClient();
  await service
    .from(DB_TABLES.tournamentRegistrations)
    .update({ mp_preference_id: pref.prefId, amount: pref.total })
    .eq("id", registrationId)
    .eq("player1_id", userId)
    .eq("payment_status", "pending_payment");

  revalidatePath("/torneos");
  revalidatePath(`/torneos/${tournamentId}`);
  return { ok: true, message: "Redirigiendo a Mercado Pago…", url: pref.initPoint };
}

export async function registerTournamentOfflineAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const method = String(formData.get("payment_method") ?? "").trim() === "transfer" ? "transfer" : "cash";
  const prep = await prepareTournamentRegistration(formData, method);
  if (!prep.ok) return prep;

  revalidatePath("/torneos");
  revalidatePath(`/torneos/${prep.tournamentId}`);
  return {
    ok: true,
    message: "¡Inscripción registrada! Pagá en el club para confirmar tu lugar.",
  };
}
