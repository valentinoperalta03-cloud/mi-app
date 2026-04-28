"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification, NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { createClient } from "@/utils/supabase/server";

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
  const { data: group } = await supabase
    .from(DB_TABLES.groupChats)
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  const groupId = (group as { id?: string } | null)?.id;
  if (!groupId) return;
  const { error } = await supabase
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
    .select("id,owner_id,visibility,match_status,level_restricted,level")
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

  const { count, error: cErr } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);
  if (cErr || (count ?? 0) >= 4) {
    redirect(`/partidos/${matchId}?join_error=cupos`);
  }

  const { error: pErr } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: matchId,
    player_id: user.id,
  });

  if (pErr && pErr.code !== "23505") {
    console.error("[requestToJoin] participant", pErr);
    redirect(`/partidos/${matchId}?join_error=db`);
  }
  await addPlayerToMatchGroup(supabase, matchId, user.id);

  const ownerId = m.owner_id;
  const { count: newCount } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);

  if ((newCount ?? 0) >= 4) {
    await supabase
      .from(DB_TABLES.matches)
      .update({ match_status: "full" })
      .eq("id", matchId);

    if (ownerId) {
      await createNotification(supabase, {
        user_id: ownerId,
        type: "player_joined",
        title: "¡Partido completo! 🎾",
        body: "Los 4 jugadores están confirmados. ¡Que empiece el partido!",
        match_id: matchId,
      });
    }
  } else if (ownerId) {
    const { data: reqProfile } = await supabase
      .from(DB_TABLES.profiles)
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();
    const playerName = (reqProfile as { name?: string | null } | null)?.name?.trim() || "Un jugador";
    const tpl = NOTIFICATION_TEMPLATES.player_joined(playerName, "tu partido");
    await createNotification(supabase, {
      user_id: ownerId,
      type: "player_joined",
      title: tpl.title,
      body: tpl.body,
      match_id: matchId,
    });
  }

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/buscar-partido");
  redirect(`/partidos/${matchId}`);
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

  const { error: pErr } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: matchId,
    player_id: playerId,
  });

  if (pErr) {
    if (pErr.code !== "23505") {
      console.error("[acceptJoinRequest] participant", pErr);
      redirect(`/partidos/${matchId}?join_error=db`);
    }
  }
  await addPlayerToMatchGroup(supabase, matchId, playerId);

  const { error: uErr } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .update({ status: "approved" })
    .eq("id", requestId)
    .eq("match_id", matchId);

  if (uErr) {
    console.error("[acceptJoinRequest] request", uErr);
    redirect(`/partidos/${matchId}?join_error=db`);
  }

  const approvedTpl = NOTIFICATION_TEMPLATES.join_approved("tu partido");
  await createNotification(supabase, {
    user_id: playerId,
    type: "join_approved",
    title: approvedTpl.title,
    body: approvedTpl.body,
    match_id: matchId,
  });

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/buscar-partido");
  redirect(`/partidos/${matchId}`);
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

