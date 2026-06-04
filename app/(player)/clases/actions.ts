"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createPracticeMercadoPagoPreference } from "@/lib/mp-practice-preference";
import { practiceTotalPrice } from "@/lib/practice-pricing";
import { createClient } from "@/utils/supabase/server";

export type CheckoutState = { ok: boolean; message: string; url?: string };

export async function beginPracticeCheckoutAction(formData: FormData): Promise<CheckoutState> {
  const sessionId = String(formData.get("session_id") ?? "").trim();
  if (!sessionId) return { ok: false, message: "Sesión inválida." };

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión para inscribirte." };

  const { data: session } = await supabase
    .from(DB_TABLES.practiceSessions)
    .select("id, session_date, status, practices(id, title, status, max_spots, price_base, level_min, level_max, club_id, clubs(name))")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, message: "Clase no encontrada." };

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
    clubs?: { name: string | null } | { name: string | null }[] | null;
  } | undefined;
  const sessionDate = String(raw.session_date);
  const sessionStatus = String(raw.status);
  if (!practice || practice.status !== "open" || sessionStatus !== "open") {
    return { ok: false, message: "Esta clase no está disponible." };
  }
  if (sessionDate < new Date().toISOString().slice(0, 10)) {
    return { ok: false, message: "La fecha ya pasó." };
  }

  const { data: me } = await supabase.from(DB_TABLES.profiles).select("level").eq("user_id", user.id).maybeSingle();
  const myLevel = (me as { level?: number | null } | null)?.level;
  if (practice.level_min != null && myLevel != null && myLevel < practice.level_min) {
    return { ok: false, message: "Tu nivel está por debajo del mínimo de la clase." };
  }
  if (practice.level_max != null && myLevel != null && myLevel > practice.level_max) {
    return { ok: false, message: "Tu nivel supera el máximo de la clase." };
  }

  const { count } = await supabase
    .from(DB_TABLES.practiceRegistrations)
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("payment_status", "approved");
  if ((count ?? 0) >= practice.max_spots) return { ok: false, message: "No hay cupos disponibles." };

  const { data: existing } = await supabase
    .from(DB_TABLES.practiceRegistrations)
    .select("id, payment_status")
    .eq("session_id", sessionId)
    .eq("player_id", user.id)
    .maybeSingle();
  if (existing) {
    const row = existing as { id: string; payment_status: string };
    if (row.payment_status === "approved") return { ok: false, message: "Ya estás inscripto." };
    await supabase.from(DB_TABLES.practiceRegistrations).delete().eq("id", row.id);
  }

  const { data: reg, error: insErr } = await supabase
    .from(DB_TABLES.practiceRegistrations)
    .insert({
      session_id: sessionId,
      player_id: user.id,
      payment_status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !reg) return { ok: false, message: insErr?.message ?? "No se pudo crear la inscripción." };
  const registrationId = (reg as { id: string }).id;

  const clubPack = practice.clubs;
  const club = Array.isArray(clubPack) ? clubPack[0] : clubPack;
  const clubName = String(club?.name ?? "Club");

  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const pref = await createPracticeMercadoPagoPreference({
    sessionId,
    registrationId,
    payerUserId: user.id,
    clubName,
    practiceTitle: practice.title,
    clubPriceBase: Number(practice.price_base),
    payerEmail: user.email ?? undefined,
    backUrls: {
      success: `${base}/clases/${sessionId}?pay=ok`,
      failure: `${base}/clases/${sessionId}?pay=fail`,
      pending: `${base}/clases/${sessionId}?pay=pending`,
    },
  });
  if ("error" in pref) {
    await supabase.from(DB_TABLES.practiceRegistrations).delete().eq("id", registrationId);
    return { ok: false, message: pref.error };
  }

  await supabase
    .from(DB_TABLES.practiceRegistrations)
    .update({ mp_preference_id: pref.prefId, amount: pref.total })
    .eq("id", registrationId);

  revalidatePath("/clases");
  revalidatePath(`/clases/${sessionId}`);
  return { ok: true, message: "Redirigiendo a Mercado Pago…", url: pref.initPoint };
}
