"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notifyClubOwner } from "@/lib/club-notify";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";
import { createPracticeMercadoPagoPreference } from "@/lib/mp-practice-preference";
import { isClubMercadoPagoConnected } from "@/lib/club-mp";
import { practicePriceBreakdown } from "@/lib/practice-pricing";
import { practiceRegistrationBlocksRetry, practiceRegistrationHoldsSpot } from "@/lib/practice-registration";
import { normalizePlayerPaymentMethod } from "@/lib/offline-payments";
import { createClient } from "@/utils/supabase/server";

export type CheckoutState = { ok: boolean; message: string; url?: string };

async function loadSessionForRegister(sessionId: string, userId: string) {
  const supabase = await createClient({ allowCookieWrites: true });

  const { data: session } = await supabase
    .from(DB_TABLES.practiceSessions)
    .select(
      "id, session_date, status, practices(id, title, status, max_spots, price_base, level_min, level_max, club_id, clubs(name, mp_access_token, mp_user_id, accepts_cash, accepts_transfer, bank_alias, bank_cbu, whatsapp))"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: "Clase no encontrada." as const };

  const raw = session as Record<string, unknown>;
  const practicePack = raw.practices;
  const practice = (Array.isArray(practicePack) ? practicePack[0] : practicePack) as {
    id: string;
    title: string;
    status: string;
    max_spots: number;
    price_base: number;
    level_min: number | null;
    level_max: number | null;
    club_id: string;
    clubs?:
      | {
          name: string | null;
          mp_access_token?: string | null;
          mp_user_id?: string | null;
          accepts_cash?: boolean | null;
          accepts_transfer?: boolean | null;
          bank_alias?: string | null;
          bank_cbu?: string | null;
          whatsapp?: string | null;
        }
      | Array<{
          name: string | null;
          mp_access_token?: string | null;
          mp_user_id?: string | null;
          accepts_cash?: boolean | null;
          accepts_transfer?: boolean | null;
          bank_alias?: string | null;
          bank_cbu?: string | null;
          whatsapp?: string | null;
        }>;
  } | undefined;

  const sessionDate = String(raw.session_date);
  const sessionStatus = String(raw.status);
  if (!practice || practice.status !== "open" || sessionStatus !== "open") {
    return { error: "Esta clase no está disponible." as const };
  }
  if (sessionDate < new Date().toISOString().slice(0, 10)) {
    return { error: "La fecha ya pasó." as const };
  }

  const { data: me } = await supabase.from(DB_TABLES.profiles).select("level, name").eq("user_id", userId).maybeSingle();
  const myLevel = (me as { level?: number | null; name?: string | null } | null)?.level;
  if (practice.level_min != null && myLevel != null && myLevel < practice.level_min) {
    return { error: "Tu nivel está por debajo del mínimo de la clase." as const };
  }
  if (practice.level_max != null && myLevel != null && myLevel > practice.level_max) {
    return { error: "Tu nivel supera el máximo de la clase." as const };
  }

  const { data: regs } = await supabase
    .from(DB_TABLES.practiceRegistrations)
    .select("id, player_id, payment_status")
    .eq("session_id", sessionId);

  const regList = (regs ?? []) as Array<{ id: string; player_id: string; payment_status: string }>;
  const spotsTaken = regList.filter((r) => practiceRegistrationHoldsSpot(r.payment_status)).length;
  if (spotsTaken >= practice.max_spots) {
    return { error: "No hay cupos disponibles." as const };
  }

  const mine = regList.find((r) => r.player_id === userId);
  if (mine?.payment_status === "approved") {
    return { error: "Ya estás inscripto." as const };
  }
  if (mine && practiceRegistrationBlocksRetry(mine.payment_status)) {
    return { error: "Ya tenés un lugar reservado en esta clase." as const };
  }

  return {
    supabase,
    practice,
    sessionDate,
    payerName: String((me as { name?: string | null } | null)?.name ?? "").trim(),
    existingRegId: mine?.payment_status === "pending" ? mine.id : undefined,
  };
}

export async function registerForPracticeAction(formData: FormData): Promise<CheckoutState> {
  const sessionId = String(formData.get("session_id") ?? "").trim();
  const paymentMethod = normalizePlayerPaymentMethod(String(formData.get("payment_method") ?? ""));
  if (!sessionId) return { ok: false, message: "Sesión inválida." };
  if (!paymentMethod) return { ok: false, message: "Elegí un método de pago." };

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión para inscribirte." };

  const loaded = await loadSessionForRegister(sessionId, user.id);
  if ("error" in loaded) return { ok: false, message: String(loaded.error) };

  const { supabase: sb, practice, sessionDate, payerName, existingRegId } = loaded;
  const clubPack = practice.clubs;
  const club = Array.isArray(clubPack) ? clubPack[0] : clubPack;
  const clubName = String(club?.name ?? "Club");
  const clubId = practice.club_id;
  const price = practicePriceBreakdown(Number(practice.price_base));
  const payAmount = price.clubPriceBase;

  if (paymentMethod === "mercadopago") {
    if (!isClubMercadoPagoConnected(club)) {
      return {
        ok: false,
        message: "Este club no tiene Mercado Pago conectado. Elegí efectivo o transferencia.",
      };
    }
  } else if (paymentMethod === "cash") {
    if (!club?.accepts_cash) return { ok: false, message: "Este club no acepta pago en efectivo." };
  } else if (paymentMethod === "transfer") {
    if (!club?.accepts_transfer) return { ok: false, message: "Este club no acepta transferencia bancaria." };
    if (!String(club?.bank_alias ?? "").trim() && !String(club?.bank_cbu ?? "").trim()) {
      return { ok: false, message: "El club no cargó datos para transferencias." };
    }
  }

  if (existingRegId) {
    await sb.from(DB_TABLES.practiceRegistrations).delete().eq("id", existingRegId);
  }

  if (paymentMethod === "cash" || paymentMethod === "transfer") {
    const payStatus = paymentMethod === "cash" ? "cash_pending" : "transfer_pending";
    const { data: reg, error: insErr } = await sb
      .from(DB_TABLES.practiceRegistrations)
      .insert({
        session_id: sessionId,
        player_id: user.id,
        payment_status: payStatus,
        payment_method: paymentMethod,
        amount: payAmount,
      })
      .select("id")
      .single();
    if (insErr || !reg) return { ok: false, message: insErr?.message ?? "No se pudo crear la inscripción." };

    const methodLabel = paymentMethod === "cash" ? "Efectivo" : "Transferencia";
    await notifyClubOwner(sb, clubId, {
      title: paymentMethod === "cash" ? "💵 Cobro clase pendiente" : "📅 Inscripción clase",
      body: `${payerName || "Un jugador"} — ${practice.title} el ${sessionDate}. Método: ${methodLabel}.`,
    });

    await createNotification(sb, {
      user_id: user.id,
      type: "reservation_confirmed",
      title: paymentMethod === "cash" ? "Inscripción con efectivo" : "Inscripción con transferencia",
      body:
        paymentMethod === "cash"
          ? `Tu lugar en "${practice.title}" el ${sessionDate} quedó reservado. Pagás en efectivo en el club.`
          : `Tu lugar en "${practice.title}" el ${sessionDate} quedó reservado. Transferí y mostrá el comprobante en el club.`,
    });

    revalidatePath("/clases");
    revalidatePath(`/clases/${sessionId}`);
    revalidatePath("/admin/cobros");
    redirect(`/clases/${sessionId}?pay=offline&method=${paymentMethod}`);
  }

  const { data: reg, error: insErr } = await sb
    .from(DB_TABLES.practiceRegistrations)
    .insert({
      session_id: sessionId,
      player_id: user.id,
      payment_status: "pending",
      payment_method: "mercadopago",
    })
    .select("id")
    .single();
  if (insErr || !reg) return { ok: false, message: insErr?.message ?? "No se pudo crear la inscripción." };
  const registrationId = (reg as { id: string }).id;

  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const pref = await createPracticeMercadoPagoPreference({
    sessionId,
    registrationId,
    payerUserId: user.id,
    clubName,
    practiceTitle: practice.title,
    payerEmail: user.email ?? undefined,
    backUrls: {
      success: `${base}/clases/${sessionId}?pay=ok`,
      failure: `${base}/clases/${sessionId}?pay=fail`,
      pending: `${base}/clases/${sessionId}?pay=pending`,
    },
  });
  if ("error" in pref) {
    await sb.from(DB_TABLES.practiceRegistrations).delete().eq("id", registrationId);
    return { ok: false, message: pref.error };
  }

  await sb
    .from(DB_TABLES.practiceRegistrations)
    .update({ mp_preference_id: pref.prefId, amount: pref.total })
    .eq("id", registrationId);

  revalidatePath("/clases");
  revalidatePath(`/clases/${sessionId}`);
  return { ok: true, message: "Redirigiendo a Mercado Pago…", url: pref.initPoint };
}
