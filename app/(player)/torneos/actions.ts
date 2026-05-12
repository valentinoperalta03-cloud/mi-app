"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createTournamentMercadoPagoPreference } from "@/lib/mp-tournament-preference";
import { playerLevelInTournamentBounds } from "@/lib/tournament-utils";
import { createClient } from "@/utils/supabase/server";

export async function beginTournamentCheckoutAction(formData: FormData): Promise<{ ok: boolean; message: string; url?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  const partnerId = String(formData.get("partner_user_id") ?? "").trim();

  if (!tournamentId) return { ok: false, message: "Torneo inválido." };

  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select(
      "id, club_id, name, tournament_type, max_pairs, price_per_pair, status, registration_deadline, category_min, category_max"
    )
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t) return { ok: false, message: "Torneo no encontrado." };
  const tour = t as {
    name: string;
    tournament_type: string;
    max_pairs: number;
    price_per_pair: number;
    status: string;
    registration_deadline: string;
    category_min: number | null;
    category_max: number | null;
    club_id: string;
  };

  if (tour.status !== "open") return { ok: false, message: "Las inscripciones no están abiertas." };
  if (new Date(tour.registration_deadline).getTime() < Date.now()) {
    return { ok: false, message: "Cerró la fecha límite de inscripción." };
  }

  const { data: me } = await supabase.from(DB_TABLES.profiles).select("level").eq("user_id", user.id).maybeSingle();
  const myLevel = (me as { level?: number | null } | null)?.level;
  if (!playerLevelInTournamentBounds(myLevel, tour.category_min, tour.category_max)) {
    return { ok: false, message: "Tu nivel no está dentro del rango permitido para este torneo." };
  }

  const isMixing = tour.tournament_type === "mixing";
  if (isMixing && partnerId) return { ok: false, message: "En mixing la inscripción es individual." };
  if (!isMixing && !partnerId) return { ok: false, message: "Elegí a tu compañero/a." };
  if (!isMixing && partnerId === user.id) return { ok: false, message: "Elegí otro jugador como compañero/a." };

  if (!isMixing) {
    const { data: op } = await supabase.from(DB_TABLES.profiles).select("level").eq("user_id", partnerId).maybeSingle();
    const ol = (op as { level?: number | null } | null)?.level;
    if (!playerLevelInTournamentBounds(ol, tour.category_min, tour.category_max)) {
      return { ok: false, message: "El nivel de tu compañero/a no entra en el rango del torneo." };
    }
  }

  const { count: approvedCount } = await supabase
    .from(DB_TABLES.tournamentRegistrations)
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("payment_status", "approved")
    .eq("waitlist", false);

  const n = (approvedCount ?? 0) as number;
  if (n >= tour.max_pairs) return { ok: false, message: "Torneo completo." };

  const { data: existing } = await supabase
    .from(DB_TABLES.tournamentRegistrations)
    .select("id, payment_status")
    .eq("tournament_id", tournamentId)
    .eq("player1_id", user.id)
    .maybeSingle();
  if (existing) {
    const row = existing as { id: string; payment_status: string };
    if (row.payment_status === "approved") return { ok: false, message: "Ya estás inscripto." };
    await supabase.from(DB_TABLES.tournamentRegistrations).delete().eq("id", row.id);
  }

  const { data: reg, error: insErr } = await supabase
    .from(DB_TABLES.tournamentRegistrations)
    .insert({
      tournament_id: tournamentId,
      player1_id: user.id,
      player2_id: isMixing ? null : partnerId,
      payment_status: "pending",
      waitlist: false,
    })
    .select("id")
    .single();
  if (insErr || !reg) return { ok: false, message: insErr?.message ?? "No se pudo crear la inscripción." };
  const registrationId = (reg as { id: string }).id;

  const { data: club } = await supabase
    .from(DB_TABLES.clubs)
    .select("name")
    .eq("id", tour.club_id)
    .maybeSingle();
  const clubName = String((club as { name?: string | null } | null)?.name ?? "Club");

  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const pref = await createTournamentMercadoPagoPreference({
    tournamentId,
    registrationId,
    payerUserId: user.id,
    clubName,
    tournamentName: tour.name,
    clubPricePerPair: Number(tour.price_per_pair),
    payerEmail: user.email ?? undefined,
    backUrls: {
      success: `${base}/torneos/${tournamentId}?pay=ok`,
      failure: `${base}/torneos/${tournamentId}?pay=fail`,
      pending: `${base}/torneos/${tournamentId}?pay=pending`,
    },
  });
  if ("error" in pref) {
    await supabase.from(DB_TABLES.tournamentRegistrations).delete().eq("id", registrationId);
    return { ok: false, message: pref.error };
  }

  await supabase
    .from(DB_TABLES.tournamentRegistrations)
    .update({ mp_preference_id: pref.prefId, amount: pref.total })
    .eq("id", registrationId);

  revalidatePath("/torneos");
  revalidatePath(`/torneos/${tournamentId}`);
  return { ok: true, message: "Redirigiendo a Mercado Pago…", url: pref.initPoint };
}
