"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { joinMatchAtomic } from "@/lib/join-match-atomic";
import { pickTeamForMatch } from "@/lib/match-teams";
import { createNotification } from "@/lib/notifications";
import { createClient, createServiceClient } from "@/utils/supabase/server";

async function addPlayerToMatchGroup(matchId: string, playerId: string) {
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

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function voteOnRequest(formData: FormData): Promise<void> {
  const requestId = getField(formData, "request_id");
  const matchId = getField(formData, "match_id");
  const voteRaw = getField(formData, "vote");
  const vote = voteRaw === "true";

  if (!requestId || !matchId) {
    redirect(`/partidos/${matchId || ""}/solicitudes`);
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: participantRow } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();
  if (!participantRow) {
    redirect(`/partidos/${matchId}/solicitudes`);
  }

  const { data: requestRow } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .select("id, match_id, player_id, status")
    .eq("id", requestId)
    .eq("match_id", matchId)
    .maybeSingle();
  if (!requestRow || (requestRow as { status?: string | null }).status !== "pending") {
    redirect(`/partidos/${matchId}/solicitudes`);
  }

  const { data: existingVote } = await supabase
    .from(DB_TABLES.matchJoinVotes)
    .select("id")
    .eq("request_id", requestId)
    .eq("voter_id", user.id)
    .maybeSingle();
  if (existingVote) {
    redirect(`/partidos/${matchId}/solicitudes`);
  }

  await supabase.from(DB_TABLES.matchJoinVotes).insert({
    request_id: requestId,
    voter_id: user.id,
    vote,
  });

  const [{ data: votes }, { count: participantsCount }] = await Promise.all([
    supabase.from(DB_TABLES.matchJoinVotes).select("vote").eq("request_id", requestId),
    supabase.from(DB_TABLES.matchParticipants).select("player_id", { count: "exact", head: true }).eq("match_id", matchId),
  ]);

  const totalParticipants = participantsCount ?? 0;
  const totalVotes = (votes ?? []).length;
  const approvals = (votes ?? []).filter((r) => (r as { vote?: boolean }).vote === true).length;
  const rejections = (votes ?? []).filter((r) => (r as { vote?: boolean }).vote === false).length;
  const requesterId = (requestRow as { player_id: string }).player_id;

  // Esperar a que todos voten
  if (totalVotes < totalParticipants) {
    revalidatePath(`/partidos/${matchId}/solicitudes`);
    redirect(`/partidos/${matchId}/solicitudes`);
  }

  // Mayoría gana — actualización atómica: solo continúa si la request sigue en "pending"
  if (approvals > rejections) {
    const { data: resolved } = await supabase
      .from(DB_TABLES.matchJoinRequests)
      .update({ status: "approved" })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id");

    if (!resolved?.length) {
      // Otra ejecución concurrente ya resolvió esta solicitud
      revalidatePath(`/partidos/${matchId}/solicitudes`);
      revalidatePath(`/partidos/${matchId}`);
      redirect(`/partidos/${matchId}/solicitudes`);
    }

    const pickedTeam = await pickTeamForMatch(supabase, matchId);
    if (pickedTeam == null) {
      await createNotification(supabase, {
        user_id: requesterId,
        type: "join_approved",
        title: "¡Solicitud aprobada!",
        body: "La mayoría del partido aprobó tu ingreso, pero el partido ya no tiene cupos libres.",
        match_id: matchId,
      });
    } else {
      // El voto decisivo puede ser de cualquier participante, no solo el dueño:
      // se llama con service_role porque join_match_atomic solo autoriza al
      // propio jugador o al dueño del partido (ver migración
      // 20260801120000_join_match_atomic_allow_service_role.sql).
      const joinResult = await joinMatchAtomic(createServiceClient(), matchId, requesterId, pickedTeam);
      if (joinResult.ok) {
        await addPlayerToMatchGroup(matchId, requesterId);
      }
      await createNotification(supabase, {
        user_id: requesterId,
        type: "join_approved",
        title: "¡Solicitud aprobada!",
        body: joinResult.ok
          ? "La mayoría del partido aprobó tu ingreso. ¡Ya estás confirmado!"
          : "Tu solicitud fue aprobada pero hubo un error al confirmarte. Ingresá al partido para intentar nuevamente.",
        match_id: matchId,
      });
    }
  } else {
    // Rechazar por mayoría — también atómico
    const { data: resolved } = await supabase
      .from(DB_TABLES.matchJoinRequests)
      .update({ status: "rejected" })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id");

    if (!resolved?.length) {
      revalidatePath(`/partidos/${matchId}/solicitudes`);
      revalidatePath(`/partidos/${matchId}`);
      redirect(`/partidos/${matchId}/solicitudes`);
    }

    await createNotification(supabase, {
      user_id: requesterId,
      type: "join_rejected",
      title: "Solicitud rechazada",
      body: "La mayoría del partido rechazó tu solicitud de ingreso.",
      match_id: matchId,
    });
  }

  revalidatePath(`/partidos/${matchId}/solicitudes`);
  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/buscar-partido");
  redirect(`/partidos/${matchId}/solicitudes`);
}
