"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatDateInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import {
  createParticipantMercadoPagoCheckout,
  createParticipantMercadoPagoPreference,
  regenerateParticipantMercadoPagoLink,
} from "@/lib/match-payments";
import { log } from "@/lib/logger";
import { notifyClubOwner } from "@/lib/club-notify";
import { createNotification, NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function clockToMinutes(clock: string): number {
  const t = clock.trim().slice(0, 5);
  const [h, m] = t.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

async function addPlayerToMatchGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchId: string,
  playerId: string
) {
  void supabase;
  const service = createServiceClient();
  const { data: group } = await service
    .from(DB_TABLES.groupChats)
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  const groupId = (group as { id?: string } | null)?.id;
  if (!groupId) return;
  const { error } = await service
    .from(DB_TABLES.groupChatMembers)
    .insert({ group_id: groupId, user_id: playerId, role: "member" });
  if (error && error.code !== "23505") {
    console.error("[group-chats] add member", error.message);
  }
}

export async function updateMatch(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const scheduledTimeRaw = getField(formData, "scheduled_time");
  const matchType = getField(formData, "match_type").toLowerCase() === "competitivo" ? "competitivo" : "amistoso";
  const visibility = getField(formData, "visibility").toLowerCase() === "privado" ? "privado" : "publico";
  const genderRaw = getField(formData, "gender_category").toLowerCase();
  const genderCategory =
    genderRaw === "femenino" ? "femenino" : genderRaw === "mixto" ? "mixto" : "masculino";
  const levelRestricted = getField(formData, "level_restricted") === "true";
  const durationMinutes = Number.parseInt(getField(formData, "duration_minutes"), 10);

  if (!matchId || !scheduledTimeRaw) {
    redirect(matchId ? `/partidos/${matchId}?edit_error=datos` : "/buscar-partido");
  }

  const timeNorm = scheduledTimeRaw.length >= 5 ? scheduledTimeRaw.slice(0, 5) : scheduledTimeRaw;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    redirect(`/partidos/${matchId}?edit_error=duracion`);
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: matchRow, error: fetchErr } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,owner_id,court_id,scheduled_date,scheduled_time,payment_status,duration_minutes,match_type"
    )
    .eq("id", matchId)
    .maybeSingle();

  if (fetchErr || !matchRow) {
    redirect("/buscar-partido");
  }

  const m = matchRow as {
    owner_id: string | null;
    court_id: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    payment_status: string | null;
    duration_minutes: number | null;
  };

  if (m.owner_id !== user.id) {
    redirect(`/partidos/${matchId}?edit_error=permiso`);
  }

  const pay = String(m.payment_status ?? "").toLowerCase();
  if (pay === "paid") {
    const { count } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id", { count: "exact", head: true })
      .eq("match_id", matchId);
    if ((count ?? 0) > 1) {
      redirect(`/partidos/${matchId}?edit_error=pagado`);
    }
  }

  const scheduledDate = String(m.scheduled_date ?? "").trim();
  if (!scheduledDate) {
    redirect(`/partidos/${matchId}?edit_error=fecha`);
  }

  const slotStart = clockToMinutes(timeNorm);
  const slotDur = durationMinutes;

  const { data: conflicts } = await supabase
    .from(DB_TABLES.matches)
    .select("id,scheduled_time,duration_minutes")
    .eq("court_id", m.court_id)
    .eq("scheduled_date", scheduledDate)
    .neq("match_status", "cancelled");

  for (const row of conflicts ?? []) {
    const r = row as { id: string; scheduled_time: string | null; duration_minutes: number | null };
    if (r.id === matchId) continue;
    const otherStart = clockToMinutes(String(r.scheduled_time ?? "").trim());
    const otherDur =
      r.duration_minutes && Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : 90;
    if (overlaps(slotStart, slotDur, otherStart, otherDur)) {
      redirect(`/partidos/${matchId}?edit_error=ocupado`);
    }
  }

  const dateIso = new Date(`${scheduledDate}T${timeNorm}:00`).toISOString();

  const { error: updErr } = await supabase
    .from(DB_TABLES.matches)
    .update({
      scheduled_time: timeNorm,
      date: dateIso,
      match_type: matchType,
      is_competitive: matchType === "competitivo",
      visibility,
      gender_category: genderCategory,
      level_restricted: levelRestricted,
      duration_minutes: durationMinutes,
    })
    .eq("id", matchId);

  if (updErr) {
    console.error("[updateMatch]", updErr);
    redirect(`/partidos/${matchId}?edit_error=db`);
  }

  revalidatePath(`/partidos/${matchId}`);
  redirect(`/partidos/${matchId}`);
}

export async function requestToJoin(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const levelOverride = getField(formData, "level_override") === "true";
  const requestedTeamRaw = getField(formData, "team");
  const requestedTeam: 1 | 2 | null =
    requestedTeamRaw === "1" ? 1 : requestedTeamRaw === "2" ? 2 : null;
  if (!matchId) {
    redirect("/buscar-partido");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id,owner_id,visibility,match_status,level_restricted,level,gender_category")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !matchRow) {
    redirect("/buscar-partido");
  }

  const m = matchRow as {
    owner_id: string | null;
    visibility: string | null;
    match_status: string | null;
    level_restricted: boolean | null;
    gender_category: string | null;
  };

  const matchStatus = String(m.match_status ?? "").toLowerCase();
  if (matchStatus === "cancelled" || matchStatus === "full") {
    redirect("/buscar-partido");
  }
  const isPrivate = String(m.visibility ?? "").toLowerCase() === "privado";
  const isLevelRestricted = Boolean(m.level_restricted);

  if (m.owner_id === user.id) {
    redirect(`/partidos/${matchId}`);
  }

  const { data: alreadyApprovedPayment } = await supabase
    .from(DB_TABLES.payments)
    .select("id")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();
  if (alreadyApprovedPayment) {
    redirect(`/partidos/${matchId}?join_error=${encodeURIComponent("Ya pagaste este partido.")}`);
  }

  const { data: invitedPayment } = await supabase
    .from(DB_TABLES.payments)
    .select("id,status")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .eq("status", "invited")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invitedPayment) {
    const mpRes = await createParticipantMercadoPagoPreference({
      supabase,
      matchId,
      payerUserId: user.id,
      requestedTeam,
    });
    if (!mpRes.ok) {
      revalidatePath(`/partidos/${matchId}`);
      revalidatePath("/home");
      revalidatePath("/buscar-partido");
      redirect(`/partidos/${matchId}?join_error=pago`);
    }

    const { error: updateInvitedErr } = await supabase
      .from(DB_TABLES.payments)
      .update({
        status: "pending",
        mp_preference_id: mpRes.prefId,
        team_preference: requestedTeam,
      })
      .eq("id", (invitedPayment as { id: string }).id);
    if (updateInvitedErr) {
      console.error("[requestToJoin] invited payment update", updateInvitedErr);
      redirect(`/partidos/${matchId}?join_error=db`);
    }

    revalidatePath(`/partidos/${matchId}`);
    revalidatePath("/home");
    revalidatePath("/buscar-partido");
    redirect(mpRes.initPoint);
  }

  const { data: userProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("gender")
    .eq("user_id", user.id)
    .maybeSingle();
  const userGender = String((userProfile as { gender?: string | null } | null)?.gender ?? "")
    .trim()
    .toLowerCase();
  const matchGenderCategory = String(m.gender_category ?? "").trim().toLowerCase();
  if (matchGenderCategory === "femenino" && userGender === "masculino") {
    redirect(`/partidos/${matchId}?join_error=genero_femenino`);
  }
  if (matchGenderCategory === "masculino" && userGender === "femenino") {
    redirect(`/partidos/${matchId}?join_error=genero_masculino`);
  }

  const { data: alreadyIn } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();

  if (alreadyIn) {
    redirect(`/partidos/${matchId}?invite=true`);
  }

  const { data: pendingReq } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .select("id,status")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();

  if (pendingReq && String((pendingReq as { status?: string }).status ?? "") === "pending") {
    redirect(`/partidos/${matchId}?invite=true&join_sent=1`);
  }

  let levelDiff = 0;
  if (isLevelRestricted) {
    const { data: ownerProfile } = await supabase
      .from(DB_TABLES.profiles)
      .select("level, category")
      .eq("user_id", m.owner_id ?? "")
      .maybeSingle();

    const { data: userProfile } = await supabase
      .from(DB_TABLES.profiles)
      .select("level, category")
      .eq("user_id", user.id)
      .maybeSingle();

    const ownerLevel = Number((ownerProfile as { level?: number | null } | null)?.level ?? 0);
    const userLevel = Number((userProfile as { level?: number | null } | null)?.level ?? 0);
    levelDiff = Math.abs(ownerLevel - userLevel);

    if (levelDiff > 1 && !levelOverride) {
      redirect(`/partidos/${matchId}?join_error=nivel`);
    }
  }

  const needsVotingRequest = isPrivate || (isLevelRestricted && levelDiff > 1 && levelOverride);
  if (needsVotingRequest) {
    const { error: insErr } = await supabase.from(DB_TABLES.matchJoinRequests).insert({
      match_id: matchId,
      player_id: user.id,
      status: "pending",
    });

    if (insErr) {
      console.error("[requestToJoin]", insErr);
      redirect(`/partidos/${matchId}?invite=true&join_error=error`);
    }

    if (m.owner_id) {
      const { data: reqProfile } = await supabase
        .from(DB_TABLES.profiles)
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      const requesterName = (reqProfile as { name?: string | null } | null)?.name?.trim() || "Un jugador";
      const tpl = NOTIFICATION_TEMPLATES.join_request(requesterName);
      await createNotification(supabase, {
        user_id: m.owner_id,
        type: "join_request",
        title: tpl.title,
        body: tpl.body,
        match_id: matchId,
      });
    }

    revalidatePath(`/partidos/${matchId}`);
    revalidatePath("/home");
    revalidatePath("/buscar-partido");
    redirect(`/partidos/${matchId}?invite=true&join_sent=1`);
  }

  const { count: countBefore, error: cErr } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);
  if (cErr || (countBefore ?? 0) >= 4) {
    redirect(`/partidos/${matchId}?join_error=cupos`);
  }

  const { data: existingPay } = await supabase
    .from(DB_TABLES.payments)
    .select("id,status,mp_preference_id")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ex = existingPay as { status?: string | null; mp_preference_id?: string | null } | null;
  if (
    ex &&
    String(ex.status ?? "").toLowerCase() === "pending" &&
    String(ex.mp_preference_id ?? "").trim().length > 0
  ) {
    const pref = encodeURIComponent(String(ex.mp_preference_id).trim());
    revalidatePath(`/partidos/${matchId}`);
    redirect(`https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${pref}`);
  }

  const mpRes = await createParticipantMercadoPagoCheckout({
    supabase,
    matchId,
    payerUserId: user.id,
    requestedTeam,
  });
  if (!mpRes.ok) {
    revalidatePath(`/partidos/${matchId}`);
    revalidatePath("/home");
    revalidatePath("/buscar-partido");
    redirect(`/partidos/${matchId}?join_error=pago`);
  }

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/buscar-partido");
  redirect(mpRes.initPoint);
}

export async function acceptJoinRequest(formData: FormData): Promise<void> {
  const requestId = getField(formData, "request_id");
  const matchId = getField(formData, "match_id");
  if (!requestId || !matchId) {
    redirect(matchId ? `/partidos/${matchId}` : "/buscar-partido");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("owner_id")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !matchRow || (matchRow as { owner_id: string | null }).owner_id !== user.id) {
    redirect(`/partidos/${matchId}?join_error=permiso`);
  }

  const { data: reqRow, error: rErr } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .select("id,player_id,status")
    .eq("id", requestId)
    .eq("match_id", matchId)
    .maybeSingle();

  if (rErr || !reqRow || String((reqRow as { status: string }).status) !== "pending") {
    redirect(`/partidos/${matchId}`);
  }

  const playerId = String((reqRow as { player_id: string }).player_id);

  const { data: alreadyApprovedPayment } = await supabase
    .from(DB_TABLES.payments)
    .select("id")
    .eq("match_id", matchId)
    .eq("user_id", playerId)
    .eq("status", "approved")
    .maybeSingle();
  if (alreadyApprovedPayment) {
    redirect(`/partidos/${matchId}?join_error=${encodeURIComponent("Ya pagaste este partido.")}`);
  }

  const { count, error: cErr } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);

  if (cErr || (count ?? 0) >= 4) {
    redirect(`/partidos/${matchId}?join_error=cupos`);
  }

  const { error: uErr } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .update({ status: "approved" })
    .eq("id", requestId)
    .eq("match_id", matchId);

  if (uErr) {
    console.error("[acceptJoinRequest] request", uErr);
    redirect(`/partidos/${matchId}?join_error=db`);
  }

  const mpRes = await createParticipantMercadoPagoCheckout({
    supabase,
    matchId,
    payerUserId: playerId,
    requestedTeam: null,
  });
  if (!mpRes.ok) {
    await supabase
      .from(DB_TABLES.matchJoinRequests)
      .update({ status: "pending" })
      .eq("id", requestId)
      .eq("match_id", matchId);
    revalidatePath(`/partidos/${matchId}`);
    redirect(`/partidos/${matchId}?join_error=pago`);
  }

  await createNotification(supabase, {
    user_id: playerId,
    type: "payment_approved",
    title: "Solicitud aceptada",
    body: `Tu solicitud fue aceptada. Completá el pago para confirmar tu lugar: ${mpRes.initPoint}`,
    match_id: matchId,
  });

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/buscar-partido");
  redirect(`/partidos/${matchId}?join_accepted=1`);
}

export async function rejectJoinRequest(formData: FormData): Promise<void> {
  const requestId = getField(formData, "request_id");
  const matchId = getField(formData, "match_id");
  if (!requestId || !matchId) {
    redirect(matchId ? `/partidos/${matchId}` : "/buscar-partido");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("owner_id")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !matchRow || (matchRow as { owner_id: string | null }).owner_id !== user.id) {
    redirect(`/partidos/${matchId}?join_error=permiso`);
  }

  const { data: reqRow } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .select("player_id")
    .eq("id", requestId)
    .eq("match_id", matchId)
    .maybeSingle();

  const { error: uErr } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .update({ status: "rejected" })
    .eq("id", requestId)
    .eq("match_id", matchId)
    .eq("status", "pending");

  if (uErr) {
    console.error("[rejectJoinRequest]", uErr);
    redirect(`/partidos/${matchId}?join_error=db`);
  }

  const rejectedPlayerId = String((reqRow as { player_id?: string } | null)?.player_id ?? "").trim();
  if (rejectedPlayerId) {
    const rejectedTpl = NOTIFICATION_TEMPLATES.join_rejected("tu partido");
    await createNotification(supabase, {
      user_id: rejectedPlayerId,
      type: "join_rejected",
      title: rejectedTpl.title,
      body: rejectedTpl.body,
      match_id: matchId,
    });
  }

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  redirect(`/partidos/${matchId}`);
}

export async function cancelParticipation(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  if (!matchId) {
    redirect("/buscar-partido");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id,owner_id,location_name,match_status,court_id,scheduled_time")
    .eq("id", matchId)
    .maybeSingle();
  if (mErr || !matchRow) {
    redirect(`/partidos/${matchId}?cancel_error=no_match`);
  }

  const m = matchRow as {
    owner_id: string | null;
    location_name: string | null;
    match_status: string | null;
    court_id: string | null;
    scheduled_time: string | null;
  };
  const matchStatusNorm = String(m.match_status ?? "").toLowerCase();
  if (matchStatusNorm === "cancelled") {
    redirect(`/partidos/${matchId}?cancel_error=finalizado`);
  }

  const ownerId = String(m.owner_id ?? "").trim();

  const { data: partRow } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();
  if (!partRow) {
    redirect(`/partidos/${matchId}?cancel_error=no_cupo`);
  }

  const { data: profileRow } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  const playerName = (profileRow as { name?: string | null } | null)?.name?.trim() || "Un jugador";
  const locationLabel = String(m.location_name ?? "").trim() || "tu partido";

  const { data: leaveAtomic, error: leaveAtomicErr } = await supabase.rpc("leave_match_atomic", {
    p_match_id: matchId,
    p_player_id: user.id,
  });
  if (leaveAtomicErr) {
    const msg = String(leaveAtomicErr.message ?? "");
    if (msg.includes("participant_not_found")) {
      redirect(`/partidos/${matchId}?cancel_ok=1`);
    }
    log.error({ event: "leave_match_atomic.failed", matchId, err: leaveAtomicErr });
    redirect(`/partidos/${matchId}?cancel_error=rpc`);
  }
  const resultRow = Array.isArray(leaveAtomic) ? leaveAtomic[0] : null;
  const delegatedOwner = String((resultRow as { owner_after?: string | null } | null)?.owner_after ?? "").trim();

  await supabase
    .from(DB_TABLES.payments)
    .update({ status: "refund_requested" })
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .eq("status", "approved");

  const { count: remainingCount } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);

  const remaining = remainingCount ?? 0;
  let matchCancelled = false;
  if (remaining === 0) {
    await supabase
      .from(DB_TABLES.matches)
      .update({ match_status: "cancelled", payment_status: "cancelled" })
      .eq("id", matchId);
    matchCancelled = true;

    const courtId = String(m.court_id ?? "").trim();
    if (courtId) {
      const { data: courtRow } = await supabase
        .from(DB_TABLES.courts)
        .select("club_id")
        .eq("id", courtId)
        .maybeSingle();
      const clubId = String((courtRow as { club_id?: string | null } | null)?.club_id ?? "").trim();
      const timeLabel = String(m.scheduled_time ?? "").trim().slice(0, 5) || "—";
      if (clubId) {
        const service = createServiceClient();
        await notifyClubOwner(service, clubId, {
          title: "Partido cancelado",
          body: `El partido de las ${timeLabel} fue cancelado. La cancha quedó libre.`,
          match_id: matchId,
        });
      }
    }
  } else if (remaining < 4) {
    await supabase.from(DB_TABLES.matches).update({ match_status: "scheduled" }).eq("id", matchId);
  }

  const isOwnerLeaving = ownerId === user.id;
  if (isOwnerLeaving && delegatedOwner) {
    const tplOwner = NOTIFICATION_TEMPLATES.match_owner_changed(locationLabel);
    await createNotification(supabase, {
      user_id: delegatedOwner,
      type: "match_owner_changed",
      title: tplOwner.title,
      body: tplOwner.body,
      match_id: matchId,
    });
  }

  if (!matchCancelled && ownerId && ownerId !== user.id) {
    await createNotification(supabase, {
      user_id: ownerId,
      type: "player_joined",
      title: "Un jugador canceló su lugar",
      body: `${playerName} dejó un cupo libre en ${locationLabel}.`,
      match_id: matchId,
    });
  }

  const service = createServiceClient();
  const { data: group } = await service.from(DB_TABLES.groupChats).select("id").eq("match_id", matchId).maybeSingle();
  const groupId = (group as { id?: string } | null)?.id;
  if (groupId) {
    await service.from(DB_TABLES.groupChatMembers).delete().eq("group_id", groupId).eq("user_id", user.id);
  }

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/buscar-partido");
  revalidatePath("/home");
  revalidatePath("/partidos");
  redirect(`/partidos/${matchId}?cancel_ok=1`);
}

export async function regenerarLinkPago(formData: FormData): Promise<void> {
  const paymentId = getField(formData, "payment_id");
  const matchId = getField(formData, "match_id");
  if (!paymentId || !matchId) {
    redirect("/buscar-partido");
  }
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const res = await regenerateParticipantMercadoPagoLink({
    supabase,
    paymentId,
    payerUserId: user.id,
  });
  if (!res.ok) {
    redirect(`/partidos/${matchId}?pay_regen_error=1`);
  }
  revalidatePath(`/partidos/${matchId}`);
  redirect(res.initPoint);
}

export async function confirmCashPayment(matchId: string): Promise<{ ok?: true; error?: string }> {
  void matchId;
  return { error: "Los turnos fijos se confirman solo con Mercado Pago." };
}

export async function cancelFixedSlotDay(matchId: string): Promise<{ ok?: true; error?: string }> {
  if (!matchId) return { error: "Partido inválido." };
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Iniciá sesión." };

  const { data: matchRow } = await supabase
    .from(DB_TABLES.matches)
    .select("id,es_turno_fijo,scheduled_date,scheduled_time,courts(name,club_id)")
    .eq("id", matchId)
    .maybeSingle();
  const match = matchRow as {
    id: string;
    es_turno_fijo: boolean | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    courts: { name: string | null; club_id: string | null } | null;
  } | null;
  if (!match || !match.es_turno_fijo) return { error: "Este partido no es un turno fijo." };

  const slotIso = `${String(match.scheduled_date ?? "").slice(0, 10)}T${String(match.scheduled_time ?? "").slice(0, 5)}:00`;
  const slotDate = new Date(slotIso);
  const diffHours = (slotDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (!Number.isFinite(diffHours) || diffHours < 24) {
    return { error: "Debés cancelar con al menos 24hs de anticipación" };
  }

  await supabase.from(DB_TABLES.matchParticipants).delete().eq("match_id", matchId).eq("player_id", user.id);
  await supabase.from(DB_TABLES.payments).update({ status: "cancelled" }).eq("match_id", matchId).eq("user_id", user.id);

  const { data: profileRow } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  const playerName = String((profileRow as { name?: string | null } | null)?.name ?? "Jugador");

  const clubId = String(match.courts?.club_id ?? "");
  if (clubId) {
    const { data: clubRow } = await supabase
      .from(DB_TABLES.clubs)
      .select("owner_id")
      .eq("id", clubId)
      .maybeSingle();
    const ownerId = String((clubRow as { owner_id?: string | null } | null)?.owner_id ?? "");
    if (ownerId) {
      await createNotification(supabase, {
        user_id: ownerId,
        type: "reservation_cancelled",
        title: "Baja en turno fijo",
        body: `${playerName} canceló su lugar en el turno de ${String(match.scheduled_time ?? "").slice(0, 5)}. La cancha quedó libre para ese día.`,
        match_id: matchId,
      });
    }
  }

  revalidatePath(`/partidos/${matchId}`);
  return { ok: true };
}

export async function confirmCashPaymentAction(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const res = await confirmCashPayment(matchId);
  redirect(`/partidos/${matchId}?join_error=${encodeURIComponent(res.error ?? "pago")}`);
}

export async function cancelFixedSlotDayAction(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const res = await cancelFixedSlotDay(matchId);
  if (res.error) redirect(`/partidos/${matchId}?cancel_error=${encodeURIComponent(res.error)}`);
  redirect(`/partidos/${matchId}?cancel_ok=1`);
}

export async function toggleMatchVisibility(
  matchId: string,
  newVisibility: "publico" | "privado"
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };
  if (!matchId) return { ok: false, message: "Partido inválido." };

  const { error } = await supabase
    .from(DB_TABLES.matches)
    .update({ visibility: newVisibility })
    .eq("id", matchId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, message: "No se pudo actualizar la visibilidad." };

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/buscar-partido");
  return { ok: true, message: newVisibility === "privado" ? "Partido privado" : "Partido público" };
}

export async function invitePlayerToMatch(
  matchId: string,
  targetUserId: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };
  if (!matchId || !targetUserId) return { ok: false, message: "Datos inválidos." };

  const { data: matchRow, error: matchErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id,owner_id,scheduled_date,scheduled_time,date,courts(name,clubs(name))")
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr || !matchRow) return { ok: false, message: "Partido no encontrado." };

  const match = matchRow as {
    owner_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    date: string;
    courts:
      | { name: string | null; clubs: { name: string | null } | { name: string | null }[] | null }
      | { name: string | null; clubs: { name: string | null } | { name: string | null }[] | null }[]
      | null;
  };
  if (match.owner_id !== user.id) return { ok: false, message: "No tenés permiso." };
  if (targetUserId === user.id) return { ok: false, message: "No podés invitarte." };

  const [{ data: alreadyIn }, { data: pendingReq }, { data: ownerProfile }] = await Promise.all([
    supabase
      .from(DB_TABLES.matchParticipants)
      .select("match_id")
      .eq("match_id", matchId)
      .eq("player_id", targetUserId)
      .maybeSingle(),
    supabase
      .from(DB_TABLES.matchJoinRequests)
      .select("id")
      .eq("match_id", matchId)
      .eq("player_id", targetUserId)
      .eq("status", "pending")
      .maybeSingle(),
    supabase.from(DB_TABLES.profiles).select("name").eq("user_id", user.id).maybeSingle(),
  ]);
  if (alreadyIn || pendingReq) return { ok: false, message: "El jugador ya está invitado." };

  const courtRel = Array.isArray(match.courts) ? match.courts[0] ?? null : match.courts;
  const clubRel = courtRel?.clubs;
  const clubObj = Array.isArray(clubRel) ? clubRel[0] ?? null : clubRel;
  const clubName = (clubObj?.name ?? "el club").trim();
  const ownerName = (ownerProfile as { name?: string | null } | null)?.name?.trim() || "Un jugador";
  const when = formatDateInArgentina(match.date, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  await createNotification(supabase, {
    user_id: targetUserId,
    type: "join_request",
    title: "¡Te invitaron a un partido!",
    body: `${ownerName} te invitó al partido en ${clubName} el ${when}`,
    match_id: matchId,
  });

  revalidatePath(`/partidos/${matchId}`);
  return { ok: true, message: "Invitación enviada" };
}




