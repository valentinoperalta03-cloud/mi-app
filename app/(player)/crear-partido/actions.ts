"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AR_TIME_ZONE, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createGroupChat } from "@/lib/group-chats";
import { createMPPreference } from "@/lib/mp-preference";
import {
  normalizePlayerPaymentMethod,
} from "@/lib/offline-payments";
import { createNotification } from "@/lib/notifications";
import { checkOnboardingStatus } from "@/lib/admin/onboarding-check";
import { checkRateLimit } from "@/lib/rate-limit";
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

function getCurrentClockInArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: AR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
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
    const allowedByRateLimit = await checkRateLimit(`create_match:${user.id}`, 5, 3600);
    if (!allowedByRateLimit) {
      return { error: "Límite de partidos creados por hora alcanzado." };
    }

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
      .select(
        "club_id, price, name, clubs!inner(name, mp_access_token, mp_user_id, accepts_cash, accepts_transfer, bank_alias, bank_cbu)"
      )
      .eq("id", courtId)
      .maybeSingle();

    if (courtError || !courtData) {
      return { error: "No se pudo obtener la información de la cancha." };
    }

    const clubIdStr = String((courtData as { club_id?: string | null }).club_id ?? "").trim();
    if (clubIdStr) {
      const { canReceiveReservations } = await checkOnboardingStatus(supabase, clubIdStr);
      if (!canReceiveReservations) {
        return { error: "Este club no está disponible para reservas en este momento." };
      }
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

    const timeNorm = scheduledTime.length >= 5 ? scheduledTime.slice(0, 5) : scheduledTime;
    const { data: slotPriceRows } = await supabase
      .from(DB_TABLES.courtSchedules)
      .select("start_time,price_override")
      .eq("court_id", courtId)
      .is("day_of_week", null)
      .not("start_time", "is", null)
      .not("price_override", "is", null);
    const matchedSlotPrice = ((slotPriceRows ?? []) as Array<{
      start_time: string | null;
      price_override: number | null;
    }>).find((row) => String(row.start_time ?? "").slice(0, 5) === timeNorm);
    const totalPrice = Number(
      matchedSlotPrice?.price_override ?? (courtData as { price: number | null }).price ?? 0
    );
    const perPlayerBase = Math.round(totalPrice / 4);
    const feeRate = Number.parseFloat(process.env.MP_MARKETPLACE_FEE ?? "0.05");
    const safeFeeRate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : 0.05;
    const perPlayerFee = Math.round(perPlayerBase * safeFeeRate * 100) / 100;
    const perPlayerTotal = Math.round((perPlayerBase + perPlayerFee) * 100) / 100;
    const clubName = String(
      ((courtData as { clubs?: { name?: string | null } | null }).clubs?.name ?? "Club")
    );
    const clubAccessToken =
      (courtData as { clubs?: { mp_access_token?: string | null } | null }).clubs?.mp_access_token ?? null;
    const clubMpUserId =
      (courtData as { clubs?: { mp_user_id?: string | null } | null }).clubs?.mp_user_id ?? null;
    const acceptsCash = Boolean(
      (courtData as { clubs?: { accepts_cash?: boolean | null } | null }).clubs?.accepts_cash
    );
    const acceptsTransfer = Boolean(
      (courtData as { clubs?: { accepts_transfer?: boolean | null } | null }).clubs?.accepts_transfer
    );
    const bankAlias = String(
      (courtData as { clubs?: { bank_alias?: string | null } | null }).clubs?.bank_alias ?? ""
    ).trim();
    const courtName = String((courtData as { name?: string | null }).name ?? "Cancha");

    const paymentMethodRaw = normalizePlayerPaymentMethod(getField(formData, "payment_method"));
    const paymentMethod = paymentMethodRaw ?? "mercadopago";

    if (paymentMethod === "mercadopago" && !clubAccessToken) {
      return {
        error: "Este club aún no tiene Mercado Pago configurado. No es posible crear partidos con MP en este club por el momento.",
      };
    }
    if (paymentMethod === "cash" && !acceptsCash) {
      return { error: "Este club no acepta pago en efectivo." };
    }
    if (paymentMethod === "transfer") {
      if (!acceptsTransfer) return { error: "Este club no acepta transferencia bancaria." };
      if (!bankAlias) return { error: "El club no cargó un alias CBU para transferencias." };
    }

    const slotStart = clockToMinutes(scheduledTime);
    const todayAr = getTodayYmdInArgentina();
    if (scheduledDate < todayAr) {
      return { error: "La fecha debe ser futura." };
    }
    if (scheduledDate === todayAr) {
      const nowMinutesAr = clockToMinutes(getCurrentClockInArgentina());
      if (slotStart < nowMinutesAr + 60) {
        return { error: "La fecha debe ser futura." };
      }
    }

    const { data: duplicatedMatch } = await supabase
      .from(DB_TABLES.matches)
      .select("id")
      .eq("owner_id", user.id)
      .eq("court_id", courtId)
      .eq("scheduled_date", scheduledDate)
      .eq("scheduled_time", timeNorm)
      .neq("match_status", "cancelled")
      .maybeSingle();
    if (duplicatedMatch) {
      return { error: "Ya tenés una reserva en ese horario." };
    }

    const { count: activeMatchesCount } = await supabase
      .from(DB_TABLES.matches)
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .in("match_status", ["scheduled", "reserved", "full"])
      .in("payment_status", ["paid", "pending", "cash_pending", "transfer_pending"]);
    if ((activeMatchesCount ?? 0) >= 3) {
      return { error: "Tenés demasiados partidos activos. Completá o cancelá uno antes de crear otro." };
    }

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

    const matchPayStatus =
      paymentMethod === "cash" ? "cash_pending" : paymentMethod === "transfer" ? "transfer_pending" : "pending";

    const { data, error } = await supabase
      .from(DB_TABLES.matches)
      .insert({
        court_id: courtId,
        owner_id: user.id,
        scheduled_date: scheduledDate,
        scheduled_time: timeNorm,
        duration_minutes: Number(durationMinutes),
        total_price: totalPrice,
        payment_status: matchPayStatus,
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

    const { error: participantError } = await supabase.from(DB_TABLES.matchParticipants).insert({
      match_id: data.id,
      player_id: user.id,
      team: 1,
    });

    if (participantError) {
      return { error: "No se pudo crear el partido." };
    }

    const invitedPaymentRows = invitedFriendIds.map((friendId) => ({
      match_id: data.id,
      user_id: friendId,
      status: "invited",
      amount: perPlayerTotal,
      marketplace_fee: perPlayerFee,
      payment_method: "mercadopago",
    }));
    if (invitedPaymentRows.length > 0) {
      await supabase.from(DB_TABLES.payments).insert(invitedPaymentRows);
    }

    if (paymentMethod === "cash" || paymentMethod === "transfer") {
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

      const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
      const partyUrl = siteOrigin ? `${siteOrigin}/partidos/${data.id}` : `/partidos/${data.id}`;
      if (invitedFriendIds.length > 0) {
        await Promise.all(
          invitedFriendIds.map((friendId) =>
            createNotification(supabase, {
              user_id: friendId,
              type: "join_request",
              title: "¡Te invitaron a un partido!",
              body: `${payerFirstName || "Un amigo"} te invitó a un partido. Confirmá tu lugar desde acá: ${partyUrl}`,
              match_id: data.id,
            })
          )
        );
      }

      redirect(`/partidos/${data.id}`);
    }

    const mp = await createMPPreference({
      matchId: data.id,
      amount: perPlayerTotal,
      clubName,
      courtName,
      date: scheduledDate,
      userId: user.id,
      externalReference: `${data.id}__${user.id}`,
      payerEmail: user.email ?? "",
      payerFirstName,
      payerLastName,
      clubAccessToken,
      clubMpUserId,
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
      payment_method: "mercadopago",
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

    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
    const partyUrl = siteOrigin ? `${siteOrigin}/partidos/${data.id}` : `/partidos/${data.id}`;
    if (invitedFriendIds.length > 0) {
      await Promise.all(
        invitedFriendIds.map((friendId) =>
          createNotification(supabase, {
            user_id: friendId,
            type: "join_request",
            title: "¡Te invitaron a un partido!",
            body: `${payerFirstName || "Un amigo"} te invitó a un partido. Confirmá tu lugar desde acá: ${partyUrl}`,
            match_id: data.id,
          })
        )
      );
    }

    redirect(mp.initPoint);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: "No se pudo crear el partido." };
  }
}
