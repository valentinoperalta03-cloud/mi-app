"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createParticipantMercadoPagoCheckout } from "@/lib/match-payments";
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

  // Mayoría gana
  if (approvals > rejections) {
    // Aprobar — generar pago, NO insertar en match_participants todavía
    await supabase.from(DB_TABLES.matchJoinRequests).update({ status: "approved" }).eq("id", requestId);

    const mpRes = await createParticipantMercadoPagoCheckout({
      supabase,
      matchId,
      payerUserId: requesterId,
    });

    if (mpRes.ok) {
      await createNotification(supabase, {
        user_id: requesterId,
        type: "join_approved",
        title: "¡Solicitud aprobada!",
        body: "La mayoría del partido aprobó tu ingreso. Completá el pago para confirmar tu lugar.",
        match_id: matchId,
      });
    } else {
      await createNotification(supabase, {
        user_id: requesterId,
        type: "join_approved",
        title: "¡Solicitud aprobada!",
        body: "Tu solicitud fue aprobada pero hubo un error al generar el pago. Ingresá al partido para intentar nuevamente.",
        match_id: matchId,
      });
    }
  } else {
    // Rechazar por mayoría
    await supabase.from(DB_TABLES.matchJoinRequests).update({ status: "rejected" }).eq("id", requestId);
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
