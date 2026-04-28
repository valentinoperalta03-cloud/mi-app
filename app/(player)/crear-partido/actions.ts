"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { DB_TABLES } from "@/lib/db-tables";
import { createGroupChat } from "@/lib/group-chats";
import { createMPPreference } from "@/lib/mp-preference";
import { createClient } from "@/utils/supabase/server";

type MatchType = "amistoso" | "competitivo";
type Visibility = "publico" | "privado";
type GenderCategory = "masculino" | "femenino" | "mixto";

type ConflictRow = {
  scheduled_time: string | null;
  duration_minutes: number | null;
};

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseFriendIds(raw: string, max = 3): string[] {
  if (!raw) return [];
  const unique = new Set(
    raw
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
  );
  return [...unique].slice(0, max);
}

function normalizeMatchType(raw: string): MatchType {
  return raw.toLowerCase().trim() === "competitivo" ? "competitivo" : "amistoso";
}

function normalizeVisibility(raw: string): Visibility {
  return raw.toLowerCase().trim() === "privado" ? "privado" : "publico";
}

function normalizeGenderCategory(raw: string): GenderCategory {
  const value = raw.toLowerCase().trim();
  if (value === "femenino") return "femenino";
  if (value === "mixto") return "mixto";
  return "masculino";
}

function clockToMinutes(clock: string): number {
  const normalized = clock.trim().slice(0, 5);
  const [hours, minutes] = normalized.split(":").map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function overlapsSlot(slotStartMin: number, slotDur: number, otherStartMin: number, otherDur: number): boolean {
  const slotEnd = slotStartMin + slotDur;
  const otherEnd = otherStartMin + otherDur;
  return slotStartMin < otherEnd && otherStartMin < slotEnd;
}

async function getUser() {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
}

export async function crearPartido(formData: FormData): Promise<{ error: string } | void> {
  const courtId = getField(formData, "court_id");
  const scheduledDate = getField(formData, "scheduled_date");
  const scheduledTime = getField(formData, "scheduled_time");
  const durationMinutesRaw = getField(formData, "duration_minutes");
  const matchType = normalizeMatchType(getField(formData, "match_type"));
  const visibility = normalizeVisibility(getField(formData, "visibility"));
  const genderCategory = normalizeGenderCategory(getField(formData, "gender_category"));
  const levelRestricted = getField(formData, "level_restricted") === "true";
  const invitedFriendIdsRaw = parseFriendIds(getField(formData, "invited_friend_ids"));
  const paidFriendIdsRaw = parseFriendIds(getField(formData, "paid_friend_ids"));

  if (!courtId || !scheduledDate || !scheduledTime || !durationMinutesRaw) {
    return { error: "Completá club, cancha, fecha y horario." };
  }

  const durationMinutes = Number.parseInt(durationMinutesRaw, 10);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duración inválida." };
  }
  if (invitedFriendIdsRaw.length > 3) {
    return { error: "Solo podés invitar hasta 3 amigos." };
  }

  try {
    const { supabase, user } = await getUser();

    const { data: payerProfile } = await supabase
      .from(DB_TABLES.profiles)
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();

    const payerName = (payerProfile as { name?: string | null } | null)?.name?.trim() ?? "";
    const nameParts = payerName.split(" ");
    const payerFirstName = nameParts[0] ?? "";
    const payerLastName = nameParts.slice(1).join(" ") ?? "";

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("gender")
      .eq("user_id", user.id)
      .maybeSingle();

    const userGender = (userProfile as { gender?: string | null } | null)?.gender;

    if (
      (genderCategory === "femenino" && userGender === "masculino") ||
      (genderCategory === "masculino" && userGender === "femenino")
    ) {
      return { error: "No podés crear un partido de esa categoría con tu género registrado." };
    }

    const { data: courtData, error: courtError } = await supabase
      .from(DB_TABLES.courts)
      .select("price, name, clubs!inner(name)")
      .eq("id", courtId)
      .maybeSingle();

    if (courtError || !courtData) {
      return { error: "No se pudo obtener la información de la cancha." };
    }

    const { data: favRows } = invitedFriendIdsRaw.length
      ? await supabase
          .from(DB_TABLES.userFavorites)
          .select("favorite_user_id")
          .eq("user_id", user.id)
          .in("favorite_user_id", invitedFriendIdsRaw)
      : { data: [] };
    const allowedFriendIds = new Set(
      (favRows ?? []).map((row: { favorite_user_id: string }) => row.favorite_user_id)
    );
    const invitedFriendIds = invitedFriendIdsRaw.filter((id) => allowedFriendIds.has(id));
    const paidFriendIds = paidFriendIdsRaw.filter((id) => invitedFriendIds.includes(id));
    const paidFriendSet = new Set(paidFriendIds);

    const totalPrice = Number((courtData as { price: number | null }).price ?? 0);
    const perPlayerBase = Math.round(totalPrice / 4);
    const feeRate = Number.parseFloat(process.env.MP_MARKETPLACE_FEE ?? "0.05");
    const safeFeeRate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : 0.05;
    const perPlayerFee = Math.round(perPlayerBase * safeFeeRate * 100) / 100;
    const perPlayerTotal = Math.round((perPlayerBase + perPlayerFee) * 100) / 100;
    const clubName = String(
      ((courtData as { clubs?: { name?: string | null } | null }).clubs?.name ?? "Club")
    );
    const courtName = String((courtData as { name?: string | null }).name ?? "Cancha");

    const slotStart = clockToMinutes(scheduledTime);
    const { data: conflicts, error: conflictsError } = await supabase
      .from(DB_TABLES.matches)
      .select("scheduled_time,duration_minutes")
      .eq("court_id", courtId)
      .eq("scheduled_date", scheduledDate)
      .neq("match_status", "cancelled");

    if (conflictsError) {
      return { error: "No se pudo validar disponibilidad." };
    }

    for (const row of (conflicts ?? []) as ConflictRow[]) {
      const otherStart = clockToMinutes(String(row.scheduled_time ?? ""));
      const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
      if (overlapsSlot(slotStart, durationMinutes, otherStart, otherDur)) {
        return { error: "Ese horario ya no está disponible." };
      }
    }

    const { data, error } = await supabase
      .from(DB_TABLES.matches)
      .insert({
        court_id: courtId,
        owner_id: user.id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime.slice(0, 5),
        duration_minutes: Number(durationMinutes),
        total_price: totalPrice,
        payment_status: "pending",
        match_status: "scheduled",
        match_type: matchType,
        is_competitive: matchType === "competitivo",
        visibility,
        gender_category: genderCategory,
        level_restricted: levelRestricted,
        location_name: clubName,
        date: new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      return { error: "No se pudo crear el partido." };
    }

    const participantRows: Array<{ match_id: string; player_id: string }> = [
      { match_id: data.id, player_id: user.id },
      ...invitedFriendIds.map((friendId) => ({ match_id: data.id, player_id: friendId })),
    ];
    const uniqueParticipants = Array.from(
      new Map(participantRows.map((row) => [row.player_id, row])).values()
    ).slice(0, 4);

    const { error: participantError } = await supabase
      .from(DB_TABLES.matchParticipants)
      .insert(uniqueParticipants);

    if (participantError) {
      return { error: "No se pudo crear el partido." };
    }

    const invitedPaymentRows = invitedFriendIds.map((friendId) => ({
      match_id: data.id,
      user_id: friendId,
      status: paidFriendSet.has(friendId) ? "approved" : "pending",
      amount: perPlayerTotal,
      marketplace_fee: perPlayerFee,
    }));
    if (invitedPaymentRows.length > 0) {
      await supabase.from(DB_TABLES.payments).insert(invitedPaymentRows);
    }

    const mp = await createMPPreference({
      matchId: data.id,
      amount: Math.round(perPlayerTotal * (1 + paidFriendIds.length) * 100) / 100,
      clubName,
      courtName,
      date: scheduledDate,
      userId: user.id,
      payerEmail: user.email ?? "",
      payerFirstName,
      payerLastName,
    });

    if ("error" in mp) {
      await supabase.from(DB_TABLES.matchParticipants).delete().eq("match_id", data.id);
      await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
      return { error: mp.error };
    }

    const { error: ownerPayErr } = await supabase.from(DB_TABLES.payments).insert({
      match_id: data.id,
      user_id: user.id,
      mp_preference_id: mp.prefId,
      status: "pending",
      amount: mp.total,
      marketplace_fee: mp.marketplaceFee,
    });

    if (ownerPayErr) {
      console.error("[mp] insert payment", ownerPayErr);
      await supabase.from(DB_TABLES.matchParticipants).delete().eq("match_id", data.id);
      await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
      return { error: "No se pudo registrar el pago. Intentá de nuevo." };
    }

    const friendlyDate = scheduledDate.split("-").reverse().join("/");
    const competitiveLabel = matchType === "competitivo" ? "Partido competitivo" : "Partido amistoso";
    const genderLabel =
      genderCategory === "femenino"
        ? "Partido femenino"
        : genderCategory === "mixto"
          ? "Partido mixto"
          : "Partido masculino";
    const groupRes = await createGroupChat(
      supabase,
      user.id,
      `Partido en ${clubName} el ${friendlyDate}`,
      `• ${competitiveLabel}\n• ${genderLabel}`,
      [],
      data.id
    );
    if (!groupRes.ok) {
      console.error("[crearPartido] group chat", groupRes.message);
    }

    redirect(mp.initPoint);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: "No se pudo crear el partido." };
  }
}
