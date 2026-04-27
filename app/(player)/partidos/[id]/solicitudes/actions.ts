"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";
import { createClient } from "@/utils/supabase/server";

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

  const currentParticipants = participantsCount ?? 0;
  const approvals = (votes ?? []).filter((row) => (row as { vote?: boolean }).vote === true).length;
  const rejections = (votes ?? []).filter((row) => (row as { vote?: boolean }).vote === false).length;
  const participantsNeeded = Math.ceil(currentParticipants / 2) + 1;
  const requesterId = (requestRow as { player_id: string }).player_id;

  if (rejections > 0) {
    await supabase
      .from(DB_TABLES.matchJoinRequests)
      .update({ status: "rejected" })
      .eq("id", requestId);

    await createNotification(supabase, {
      user_id: requesterId,
      type: "join_rejected",
      title: "Solicitud rechazada",
      body: "Tu solicitud para unirte a este partido fue rechazada por votación.",
      match_id: matchId,
    });
  } else if (approvals >= participantsNeeded) {
    await supabase.from(DB_TABLES.matchJoinRequests).update({ status: "approved" }).eq("id", requestId);
    await supabase.from(DB_TABLES.matchParticipants).insert(
      {
        match_id: matchId,
        player_id: requesterId,
      }
    );

    const { count: newCount } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id", { count: "exact", head: true })
      .eq("match_id", matchId);
    if ((newCount ?? 0) >= 4) {
      await supabase.from(DB_TABLES.matches).update({ match_status: "full" }).eq("id", matchId);
    }

    await createNotification(supabase, {
      user_id: requesterId,
      type: "join_approved",
      title: "¡Solicitud aprobada!",
      body: "La mayoría del partido aprobó tu ingreso.",
      match_id: matchId,
    });
  }

  revalidatePath(`/partidos/${matchId}/solicitudes`);
  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/buscar-partido");
  redirect(`/partidos/${matchId}/solicitudes`);
}
