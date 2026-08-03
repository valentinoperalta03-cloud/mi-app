"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkCancellationLimit } from "@/lib/cancellation-guard";
import { formatDateInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { isMatchPrivate, normalizeMatchVisibility } from "@/lib/match-visibility";
import { log } from "@/lib/logger";
import { pickTeamForMatch } from "@/lib/match-teams";
import { notifyClubOwner } from "@/lib/club-notify";
import { generateInviteToken } from "@/lib/invite-token";
import { joinMatchAtomic } from "@/lib/join-match-atomic";
import { createMPPreference } from "@/lib/mp-preference";
import { createNotification, NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { refundApprovedPayment } from "@/lib/payment-refund";
import { checkRateLimit } from "@/lib/rate-limit";
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

async function getClubIdForCourt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courtId: string
): Promise<string> {
  if (!courtId) return "";
  const { data: courtRow } = await supabase
    .from(DB_TABLES.courts)
    .select("club_id")
    .eq("id", courtId)
    .maybeSingle();
  return String((courtRow as { club_id?: string | null } | null)?.club_id ?? "").trim();
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
  const visibility = normalizeMatchVisibility(getField(formData, "visibility"));
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
    .neq("match_status", "cancelled")
    .or("payment_status.is.null,and(payment_status.neq.expired,payment_status.neq.rejected)");

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

  const dateIso = new Date(`${scheduledDate}T${timeNorm}:00-03:00`).toISOString();

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

  const allowedByRateLimit = await checkRateLimit(`join_match:${user.id}`, 10, 3600);
  if (!allowedByRateLimit) {
    redirect(`/partidos/${matchId}?join_error=rate_limit`);
  }

  const { isOnboardingComplete } = await import("@/lib/onboarding-check");
  const complete = await isOnboardingComplete(supabase, user.id);
  if (!complete) {
    redirect("/onboarding");
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

  const matchStatusCheck = String(m.match_status ?? "").toLowerCase();
  if (
    matchStatusCheck === "cancelled" ||
    matchStatusCheck === "full" ||
    matchStatusCheck === "finished"
  ) {
    redirect(`/partidos/${matchId}?join_error=no_disponible`);
  }
  const isPrivate = isMatchPrivate(m.visibility);
  const isLevelRestricted = Boolean(m.level_restricted);
  // Redirects internos del propio server action: el token es legítimo porque
  // lo generamos nosotros, no lo repetimos ciegamente desde la URL de entrada.
  // Solo hace falta para partidos privados (público no lo valida igual).
  const inviteToken = isPrivate ? generateInviteToken(matchId) : "";

  if (m.owner_id === user.id) {
    redirect(`/partidos/${matchId}`);
  }

  const { data: userProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("gender, name")
    .eq("user_id", user.id)
    .maybeSingle();
  const userGender = String((userProfile as { gender?: string | null } | null)?.gender ?? "")
    .trim()
    .toLowerCase();
  const joinerName = (userProfile as { name?: string | null } | null)?.name?.trim() || "Un jugador";
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
    redirect(`/partidos/${matchId}?invite=${inviteToken}`);
  }

  const { data: pendingReq } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .select("id,status")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();

  if (pendingReq && String((pendingReq as { status?: string }).status ?? "") === "pending") {
    redirect(`/partidos/${matchId}?invite=${inviteToken}&join_sent=1`);
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
    const { error: insErr } = await supabase.from(DB_TABLES.matchJoinRequests).upsert(
      {
        match_id: matchId,
        player_id: user.id,
        status: "pending",
        voting_closed: false,
      },
      { onConflict: "match_id,player_id" }
    );

    if (insErr) {
      console.error("[requestToJoin]", insErr);
      redirect(`/partidos/${matchId}?invite=${inviteToken}&join_error=error`);
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
    redirect(`/partidos/${matchId}?invite=${inviteToken}&join_sent=1`);
  }

  const joinResult = await joinMatchAtomic(supabase, matchId, user.id, requestedTeam);
  if (!joinResult.ok) {
    revalidatePath(`/partidos/${matchId}`);
    revalidatePath("/home");
    revalidatePath("/buscar-partido");
    if (joinResult.reason === "already_in") {
      redirect(`/partidos/${matchId}?invite=${inviteToken}`);
    }
    if (joinResult.reason === "team_full" || joinResult.reason === "match_full") {
      redirect(`/partidos/${matchId}?join_error=cupos`);
    }
    if (joinResult.reason === "match_closed") {
      redirect(`/partidos/${matchId}?join_error=no_disponible`);
    }
    redirect(`/partidos/${matchId}?join_error=db`);
  }

  await addPlayerToMatchGroup(supabase, matchId, user.id);

  if (m.owner_id && m.owner_id !== user.id) {
    const tpl = NOTIFICATION_TEMPLATES.player_joined(joinerName, "tu partido");
    await createNotification(supabase, {
      user_id: m.owner_id,
      type: "player_joined",
      title: tpl.title,
      body: tpl.body,
      match_id: matchId,
    });
  }

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/buscar-partido");
  redirect(`/partidos/${matchId}?join_accepted=1&joined=true`);
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

  const { count, error: cErr } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);

  if (cErr || (count ?? 0) >= 4) {
    redirect(`/partidos/${matchId}?join_error=cupos`);
  }

  // El organizador resuelve directo: cierra la votación en curso (solicitudes/actions.ts)
  // para que un voto que llegue después no vuelva a resolver la misma solicitud.
  const { error: uErr } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .update({ status: "approved", voting_closed: true })
    .eq("id", requestId)
    .eq("match_id", matchId);

  if (uErr) {
    console.error("[acceptJoinRequest] request", uErr);
    redirect(`/partidos/${matchId}?join_error=db`);
  }

  const pickedTeam = await pickTeamForMatch(supabase, matchId);
  if (pickedTeam == null) {
    await supabase
      .from(DB_TABLES.matchJoinRequests)
      .update({ status: "pending", voting_closed: false })
      .eq("id", requestId)
      .eq("match_id", matchId);
    redirect(`/partidos/${matchId}?join_error=cupos`);
  }

  const { error: partErr } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: matchId,
    player_id: playerId,
    team: pickedTeam,
  });
  if (partErr) {
    await supabase
      .from(DB_TABLES.matchJoinRequests)
      .update({ status: "pending", voting_closed: false })
      .eq("id", requestId)
      .eq("match_id", matchId);
    revalidatePath(`/partidos/${matchId}`);
    redirect(`/partidos/${matchId}?join_error=db`);
  }

  await addPlayerToMatchGroup(supabase, matchId, playerId);

  const { count: participantsAfter } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);
  if ((participantsAfter ?? 0) >= 4) {
    await supabase
      .from(DB_TABLES.matches)
      .update({ match_status: "full" })
      .eq("id", matchId)
      .neq("match_status", "cancelled");
  }

  await createNotification(supabase, {
    user_id: playerId,
    type: "join_approved",
    title: "Solicitud aceptada",
    body: "Tu solicitud fue aceptada. ¡Ya estás confirmado en el partido!",
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
    .update({ status: "rejected", voting_closed: true })
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

  const cancellationGuard = await checkCancellationLimit(supabase, user.id);
  if (!cancellationGuard.allowed) {
    redirect(`/partidos/${matchId}?cancel_error=rate_limit`);
  }

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id,owner_id,location_name,match_status,match_type,court_id,scheduled_time,total_price")
    .eq("id", matchId)
    .maybeSingle();
  if (mErr || !matchRow) {
    redirect(`/partidos/${matchId}?cancel_error=no_match`);
  }

  const m = matchRow as {
    owner_id: string | null;
    location_name: string | null;
    match_status: string | null;
    match_type: string | null;
    court_id: string | null;
    scheduled_time: string | null;
    total_price: number | null;
  };
  const matchStatusNorm = String(m.match_status ?? "").toLowerCase();
  if (matchStatusNorm === "cancelled") {
    redirect(`/partidos/${matchId}?cancel_error=finalizado`);
  }

  const ownerId = String(m.owner_id ?? "").trim();
  const isOwnerLeaving = ownerId === user.id;

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

  // Si este jugador tenía un pago de MP aprobado, se reembolsa ANTES de sacarlo
  // del partido: si el reembolso falla, no le tocamos el lugar — queda
  // reservado y el jugador puede reintentar, en vez de perder turno y plata.
  const { data: myPaymentRow } = await supabase
    .from(DB_TABLES.payments)
    .select("id")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();
  const myPaymentId = (myPaymentRow as { id: string } | null)?.id ?? null;
  if (myPaymentId) {
    const refundOutcome = await refundApprovedPayment(supabase, myPaymentId);
    if (refundOutcome.kind === "failed") {
      log.error({ event: "cancelParticipation.refund_failed", matchId, userId: user.id });
      redirect(`/partidos/${matchId}?cancel_error=refund_failed`);
    }
  }

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
  const rpcCancelled = Boolean((resultRow as { cancelled?: boolean | null } | null)?.cancelled);
  let delegatedOwner = String((resultRow as { owner_after?: string | null } | null)?.owner_after ?? "").trim();

  const { count: remainingCount } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);

  const remaining = remainingCount ?? 0;
  let matchCancelled = rpcCancelled;

  if (!delegatedOwner && remaining > 0) {
    const { data: firstRemaining } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const newOwner = String((firstRemaining as { player_id?: string } | null)?.player_id ?? "").trim();

    if (newOwner) {
      await supabase.from(DB_TABLES.matches).update({ owner_id: newOwner }).eq("id", matchId);
      delegatedOwner = newOwner;
      // La notificación al nuevo organizador se envía una sola vez, más abajo
      // (bloque "isOwnerLeaving && delegatedOwner"), sin importar si el RPC ya
      // lo había asignado o si se asignó acá — antes se notificaba dos veces.
    }
  }

  if (remaining === 0) {
    const totalPrice = m.total_price != null ? Number(m.total_price) : null;
    await supabase
      .from(DB_TABLES.matches)
      .update({
        match_status: "cancelled",
        payment_status: "cancelled",
        financial_status: "unpaid",
        amount_paid: 0,
        amount_pending: totalPrice ?? 0,
      })
      .eq("id", matchId);
    matchCancelled = true;

    const courtId = String(m.court_id ?? "").trim();
    const clubId = await getClubIdForCourt(supabase, courtId);
    const timeLabel = String(m.scheduled_time ?? "").trim().slice(0, 5) || "—";
    if (clubId) {
      const service = createServiceClient();
      await notifyClubOwner(service, clubId, {
        title: "Partido cancelado",
        body: `El partido de las ${timeLabel} fue cancelado. La cancha quedó libre.`,
        match_id: matchId,
      });
    }
  } else if (remaining < 4 && !matchCancelled) {
    const isReservationType = String(m.match_type ?? "").toLowerCase() === "reservation";
    const downgradedStatus = isReservationType ? "reserved" : "scheduled";
    const updatePayload: Record<string, unknown> = { match_status: downgradedStatus };

    // El organizador que se va puede haberse llevado (o recibido reembolso de)
    // el pago que hizo al crear el partido: el nuevo organizador no puede
    // heredar un estado "pagado" que ya no corresponde a plata real en el club.
    if (isOwnerLeaving) {
      const totalPrice = m.total_price != null ? Number(m.total_price) : 0;
      updatePayload.payment_status = "pending";
      updatePayload.financial_status = "unpaid";
      updatePayload.amount_paid = 0;
      updatePayload.amount_pending = totalPrice;
    }

    await supabase.from(DB_TABLES.matches).update(updatePayload).eq("id", matchId);

    if (isOwnerLeaving) {
      const clubId = await getClubIdForCourt(supabase, String(m.court_id ?? "").trim());
      if (clubId) {
        const timeLabel = String(m.scheduled_time ?? "").trim().slice(0, 5) || "—";
        const service = createServiceClient();
        await notifyClubOwner(service, clubId, {
          title: "Cambio de organizador",
          body: `El organizador del turno de las ${timeLabel} dejó su lugar. El pago quedó pendiente para el nuevo organizador.`,
          match_id: matchId,
        });
      }
    }
  }

  if (matchCancelled) {
    const { data: paidPayments } = await supabase
      .from(DB_TABLES.payments)
      .select("id, user_id")
      .eq("match_id", matchId)
      .in("status", ["approved", "refund_requested"]);

    for (const payment of paidPayments ?? []) {
      const row = payment as { id: string; user_id: string };
      const refundOutcome = await refundApprovedPayment(supabase, row.id);
      if (refundOutcome.kind === "failed") {
        log.error({ event: "cancelParticipation.refund_failed", matchId, userId: row.user_id });
      }

      await createNotification(supabase, {
        user_id: row.user_id,
        type: "reservation_cancelled",
        title: refundOutcome.kind === "refunded" ? "Partido cancelado - Reembolso procesado" : "Partido cancelado",
        body:
          refundOutcome.kind === "refunded"
            ? "El partido fue cancelado y ya procesamos tu reembolso."
            : refundOutcome.kind === "failed"
              ? "El partido fue cancelado. No pudimos procesar tu reembolso automáticamente, contactá a soporte."
              : "El partido fue cancelado.",
        match_id: matchId,
      });
    }
  }

  if (isOwnerLeaving && delegatedOwner && delegatedOwner !== user.id) {
    const tplOwner = NOTIFICATION_TEMPLATES.match_owner_changed(locationLabel);
    await createNotification(supabase, {
      user_id: delegatedOwner,
      type: "match_owner_changed",
      title: tplOwner.title,
      body: tplOwner.body,
      match_id: matchId,
    });

    const { data: remainingForOwnerChange } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", matchId);
    const othersToNotify = ((remainingForOwnerChange ?? []) as Array<{ player_id: string }>)
      .map((p) => p.player_id)
      .filter((pid) => pid !== delegatedOwner && pid !== user.id);
    if (othersToNotify.length > 0) {
      const { data: newOwnerProfile } = await supabase
        .from(DB_TABLES.profiles)
        .select("name")
        .eq("user_id", delegatedOwner)
        .maybeSingle();
      const newOwnerName = (newOwnerProfile as { name?: string | null } | null)?.name?.trim() || "Un jugador";
      for (const pid of othersToNotify) {
        await createNotification(supabase, {
          user_id: pid,
          type: "match_owner_changed",
          title: "Nuevo organizador",
          body: `${newOwnerName} es el nuevo organizador del partido.`,
          match_id: matchId,
        });
      }
    }
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

export async function regenerarLinkPago(
  formData: FormData
): Promise<{ error: string } | { mpUrl: string }> {
  const matchId = getField(formData, "match_id");
  const paymentId = getField(formData, "payment_id");
  if (!matchId || !paymentId) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Iniciá sesión para regenerar el link de pago." };
  }

  const { data: paymentRow, error: payErr } = await supabase
    .from(DB_TABLES.payments)
    .select("id, user_id, match_id, status")
    .eq("id", paymentId)
    .eq("match_id", matchId)
    .maybeSingle();
  if (payErr || !paymentRow) {
    return { error: "No encontramos ese pago." };
  }
  const payment = paymentRow as { id: string; user_id: string; status: string | null };
  if (payment.user_id !== user.id) {
    return { error: "No tenés permiso sobre este pago." };
  }
  if (String(payment.status ?? "").toLowerCase() !== "expired") {
    return { error: "Este pago ya no está vencido." };
  }

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "owner_id, match_status, scheduled_date, total_price, amount_paid, amount_pending, court_id, courts(name, club_id, clubs(name))"
    )
    .eq("id", matchId)
    .maybeSingle();
  if (mErr || !matchRow) {
    return { error: "Partido no encontrado." };
  }

  const m = matchRow as {
    owner_id: string | null;
    match_status: string | null;
    scheduled_date: string | null;
    total_price: number | null;
    amount_paid: number | null;
    amount_pending: number | null;
    court_id: string | null;
    courts:
      | { name: string | null; club_id: string | null; clubs: { name: string | null } | { name: string | null }[] | null }
      | { name: string | null; club_id: string | null; clubs: { name: string | null } | { name: string | null }[] | null }[]
      | null;
  };
  const courtRel = Array.isArray(m.courts) ? m.courts[0] ?? null : m.courts;
  const clubRel = courtRel?.clubs ?? null;
  const clubObj = Array.isArray(clubRel) ? clubRel[0] ?? null : clubRel;
  if (m.owner_id !== user.id) {
    return { error: "Solo el organizador puede regenerar este link." };
  }
  const matchStatusNorm = String(m.match_status ?? "").toLowerCase();
  if (matchStatusNorm === "cancelled") {
    return { error: "Este partido ya fue cancelado." };
  }

  const totalPrice = Number(m.total_price ?? 0);
  const amountPaid = Number(m.amount_paid ?? 0);
  const amountPending = m.amount_pending != null ? Number(m.amount_pending) : totalPrice - amountPaid;
  const amount = amountPending > 0 ? amountPending : totalPrice;
  if (!(amount > 0)) {
    return { error: "No hay ningún saldo pendiente para este partido." };
  }

  const clubId = String(courtRel?.club_id ?? "").trim();
  // mp_access_token esta revocada para anon/authenticated: se lee aparte con service client.
  const { data: clubMpRow } = clubId
    ? await createServiceClient().from(DB_TABLES.clubs).select("mp_access_token").eq("id", clubId).maybeSingle()
    : { data: null };
  const clubAccessToken = (clubMpRow as { mp_access_token?: string | null } | null)?.mp_access_token ?? null;
  if (!clubAccessToken) {
    return { error: "Este club no tiene Mercado Pago configurado." };
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

  const mp = await createMPPreference({
    matchId,
    amount,
    clubName: clubObj?.name ?? "Club",
    courtName: courtRel?.name ?? "Cancha",
    date: String(m.scheduled_date ?? ""),
    userId: user.id,
    externalReference: `${matchId}__${user.id}`,
    payerEmail: user.email ?? "",
    payerFirstName,
    payerLastName,
    clubAccessToken,
  });
  if ("error" in mp) {
    return { error: mp.error };
  }

  const { error: updErr } = await supabase
    .from(DB_TABLES.payments)
    .update({
      mp_preference_id: mp.prefId,
      status: "pending",
      amount: mp.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  if (updErr) {
    return { error: "No se pudo actualizar el pago. Intentá de nuevo." };
  }

  revalidatePath(`/partidos/${matchId}`);
  return { mpUrl: mp.initPoint };
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
  // Pagos aprobados de MP → reembolso real; pagos pendientes/invitados → cancelar
  const { data: myPaymentRow } = await supabase
    .from(DB_TABLES.payments)
    .select("id")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();
  const myPaymentId = (myPaymentRow as { id: string } | null)?.id ?? null;
  if (myPaymentId) {
    const refundOutcome = await refundApprovedPayment(supabase, myPaymentId);
    if (refundOutcome.kind === "failed") {
      log.error({ event: "cancelFixedSlotDay.refund_failed", matchId, userId: user.id });
    }
  }
  await supabase
    .from(DB_TABLES.payments)
    .update({ status: "cancelled" })
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .in("status", ["pending", "invited"]);

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

export async function kickPlayerFromMatch(
  matchId: string,
  playerIdToKick: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Iniciá sesión." };
  if (!matchId || !playerIdToKick) return { ok: false, error: "Datos inválidos." };

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("owner_id, match_status, match_type, location_name")
    .eq("id", matchId)
    .maybeSingle();
  if (mErr || !matchRow) return { ok: false, error: "Partido no encontrado." };

  const m = matchRow as {
    owner_id: string | null;
    match_status: string | null;
    match_type: string | null;
    location_name: string | null;
  };
  if (m.owner_id !== user.id) {
    return { ok: false, error: "Solo el organizador puede expulsar jugadores." };
  }
  if (playerIdToKick === m.owner_id) {
    return { ok: false, error: "No podés expulsarte a vos mismo." };
  }

  const { data: kickedProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", playerIdToKick)
    .maybeSingle();
  const kickedName = (kickedProfile as { name?: string | null } | null)?.name?.trim() || "El jugador";

  const { error: delErr } = await supabase
    .from(DB_TABLES.matchParticipants)
    .delete()
    .eq("match_id", matchId)
    .eq("player_id", playerIdToKick);
  if (delErr) {
    return { ok: false, error: "No se pudo expulsar al jugador." };
  }

  const service = createServiceClient();
  const { data: group } = await service
    .from(DB_TABLES.groupChats)
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  const groupId = (group as { id?: string } | null)?.id;
  if (groupId) {
    await service.from(DB_TABLES.groupChatMembers).delete().eq("group_id", groupId).eq("user_id", playerIdToKick);
  }

  const locationLabel = String(m.location_name ?? "").trim() || "el partido";
  await createNotification(supabase, {
    user_id: playerIdToKick,
    type: "match_cancelled",
    title: "Te sacaron del partido",
    body: `El organizador te sacó de ${locationLabel}.`,
    match_id: matchId,
  });

  const { data: remainingRows } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId);
  const remainingIds = ((remainingRows ?? []) as Array<{ player_id: string }>)
    .map((r) => r.player_id)
    .filter((pid) => pid !== user.id);
  for (const pid of remainingIds) {
    await createNotification(supabase, {
      user_id: pid,
      type: "match_cancelled",
      title: "Un jugador fue expulsado",
      body: `${kickedName} fue expulsado del partido.`,
      match_id: matchId,
    });
  }

  const matchStatusNorm = String(m.match_status ?? "").toLowerCase();
  if (matchStatusNorm === "full") {
    const isReservationType = String(m.match_type ?? "").toLowerCase() === "reservation";
    await supabase
      .from(DB_TABLES.matches)
      .update({ match_status: isReservationType ? "reserved" : "scheduled" })
      .eq("id", matchId);
  }

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/buscar-partido");
  return { ok: true };
}

