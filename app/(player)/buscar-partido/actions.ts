"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { joinMatchAtomic } from "@/lib/join-match-atomic";
import { pickTeamForMatch } from "@/lib/match-teams";
import { createNotification, NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { isLevelCompatible } from "@/lib/match-level";
import { createClient, createServiceClient } from "@/utils/supabase/server";

export type ToggleJoinState = {
  success: boolean;
  message: string;
};

const initialState: ToggleJoinState = { success: false, message: "" };
const TOTAL_SLOTS = 4;

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

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function toggleMatchParticipationAction(
  prevState: ToggleJoinState = initialState,
  formData: FormData
): Promise<ToggleJoinState> {
  void prevState;

  const matchId = getField(formData, "match_id");
  const intent = getField(formData, "intent");

  if (!matchId || (intent !== "join" && intent !== "leave")) {
    return { success: false, message: "Datos incompletos para actualizar tu cupo." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Necesitas iniciar sesion para anotarte." };
  }

  const playerId = user.id;

  const { data: profileRow, error: profileError } = await supabase
    .from(DB_TABLES.profiles)
    .select("gender,name")
    .eq("user_id", playerId)
    .maybeSingle();
  if (profileError) {
    return {
      success: false,
      message: `No pudimos validar tu perfil: ${profileError.message}`,
    };
  }
  const playerGender = (profileRow as { gender?: "masculino" | "femenino" | null } | null)?.gender ?? null;
  const playerName = (profileRow as { name?: string | null } | null)?.name?.trim() || "Un jugador";

  if (intent === "leave") {
    const { data: matchForLeave, error: leaveFetchError } = await supabase
      .from(DB_TABLES.matches)
      .select("id,owner_id,court_id,scheduled_date,scheduled_time,location_name")
      .eq("id", matchId)
      .maybeSingle();
    if (leaveFetchError || !matchForLeave) {
      return { success: false, message: "No pudimos validar el partido." };
    }

    const leaveMatch = matchForLeave as {
      id: string;
      owner_id: string | null;
      court_id: string | null;
      scheduled_date: string | null;
      scheduled_time: string | null;
      location_name: string | null;
    };

    const { data: participantsBefore } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", matchId);
    const participantIds = ((participantsBefore ?? []) as Array<{ player_id: string }>).map((p) => p.player_id);

    const { data: leaveAtomic, error: leaveAtomicErr } = await supabase.rpc("leave_match_atomic", {
      p_match_id: matchId,
      p_player_id: playerId,
    });
    if (leaveAtomicErr) {
      return { success: false, message: `No pudimos sacarte del partido: ${leaveAtomicErr.message}` };
    }
    const resultRow = Array.isArray(leaveAtomic) ? leaveAtomic[0] : null;
    const delegatedOwner = String((resultRow as { owner_after?: string | null } | null)?.owner_after ?? "").trim();
    const wasCancelled = Boolean((resultRow as { cancelled?: boolean } | null)?.cancelled);

    const remainingIds = participantIds.filter((id) => id !== playerId);
    const isOwnerLeaving = leaveMatch.owner_id === playerId;
    if (isOwnerLeaving && delegatedOwner) {
      const tplOwner = NOTIFICATION_TEMPLATES.match_owner_changed(leaveMatch.location_name ?? "el club");
      await createNotification(supabase, {
        user_id: delegatedOwner,
        type: "match_owner_changed",
        title: tplOwner.title,
        body: tplOwner.body,
        match_id: matchId,
      });
    }

    const notifyIds = remainingIds.filter((id) => id !== playerId);
    const cancelTpl = NOTIFICATION_TEMPLATES.match_cancelled(leaveMatch.location_name ?? "el club");
    for (const uid of notifyIds) {
      await createNotification(supabase, {
        user_id: uid,
        type: "match_cancelled",
        title: cancelTpl.title,
        body: isOwnerLeaving
          ? wasCancelled
            ? cancelTpl.body
            : "El creador salió del partido y se reasignó un nuevo organizador."
          : `${playerName} salió del partido.`,
        match_id: matchId,
      });
    }

    revalidatePath("/buscar-partido");
    revalidatePath("/feed");
    revalidatePath("/comunidad/para-ti");
    revalidatePath("/partidos");
    revalidatePath("/home");
    return { success: true, message: "Saliste del partido." };
  }

  const { data: existingRow, error: existingError } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("match_id", matchId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (existingError) {
    return {
      success: false,
      message: `No pudimos validar tu estado: ${existingError.message}`,
    };
  }

  if (existingRow) {
    return { success: false, message: "Ya estas anotado en este partido." };
  }

  const { data: matchRow, error: matchError } = await supabase
    .from(DB_TABLES.matches)
    .select("gender_category, level_restricted, owner_id, total_price")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError || !matchRow) {
    return {
      success: false,
      message: `No pudimos validar el partido: ${matchError?.message ?? "partido inexistente"}`,
    };
  }
  const matchData = matchRow as {
    gender_category?: "masculino" | "femenino" | "mixto" | null;
    level_restricted?: boolean | null;
    owner_id?: string | null;
    total_price?: number | null;
  };
  const genderCategory = matchData.gender_category ?? "mixto";
  if (genderCategory !== "mixto" && playerGender !== genderCategory) {
    const categoryLabel = genderCategory === "masculino" ? "Masculino" : "Femenino";
    return { success: false, message: `Este partido es exclusivo para ${categoryLabel}.` };
  }

  const { count, error: countError } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);

  if (countError) {
    return {
      success: false,
      message: `No pudimos validar cupos: ${countError.message}`,
    };
  }

  if ((count ?? 0) >= TOTAL_SLOTS) {
    return { success: false, message: "Este partido ya esta completo." };
  }

  if (matchData.level_restricted) {
    const { data: playerCategoryRow, error: playerCategoryError } = await supabase
      .from(DB_TABLES.profiles)
      .select("category")
      .eq("user_id", playerId)
      .maybeSingle();
    if (playerCategoryError) {
      return { success: false, message: "No pudimos validar tu nivel." };
    }

    const ownerId = matchData.owner_id ?? "";
    const { data: creatorCategoryRow, error: creatorCategoryError } = await supabase
      .from(DB_TABLES.profiles)
      .select("category")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (creatorCategoryError) {
      return { success: false, message: "No pudimos validar el nivel del creador." };
    }

    const playerCategory = (playerCategoryRow as { category?: string | null } | null)?.category ?? null;
    const creatorCategory = (creatorCategoryRow as { category?: string | null } | null)?.category ?? null;
    const compatible = isLevelCompatible(playerCategory, creatorCategory);

    if (!compatible) {
      const { data: existingRequest, error: existingRequestError } = await supabase
        .from(DB_TABLES.matchJoinRequests)
        .select("id,status")
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .maybeSingle();
      if (existingRequestError) {
        return { success: false, message: "No pudimos validar tu solicitud de acceso." };
      }
      if (existingRequest && (existingRequest as { status?: string | null }).status === "pending") {
        return {
          success: false,
          message: "Ya enviaste una solicitud para este partido. Está pendiente de aprobación.",
        };
      }

      const { error: requestError } = await supabase.from(DB_TABLES.matchJoinRequests).upsert(
        {
          match_id: matchId,
          player_id: playerId,
          status: "pending",
        },
        { onConflict: "match_id,player_id" }
      );
      if (requestError) {
        return { success: false, message: "No se pudo enviar la solicitud de acceso." };
      }

      revalidatePath("/home");
      revalidatePath(`/partidos/${matchId}/solicitudes`);
      return {
        success: true,
        message: "Tu nivel no es compatible. Se envió una solicitud a los jugadores del partido para que voten.",
      };
    }
  }

  const pickedTeam = await pickTeamForMatch(supabase, matchId);
  if (pickedTeam == null) {
    return { success: false, message: "Este partido ya no tiene cupos libres." };
  }

  const joinResult = await joinMatchAtomic(supabase, matchId, playerId, pickedTeam);
  if (!joinResult.ok) {
    if (joinResult.reason === "already_in") {
      return { success: false, message: "Ya estabas anotado en este partido." };
    }
    if (joinResult.reason === "team_full" || joinResult.reason === "match_full") {
      return { success: false, message: "Este partido ya esta completo." };
    }
    return { success: false, message: "No se pudo completar la inscripcion." };
  }
  await addPlayerToMatchGroup(supabase, matchId, playerId);

  if (matchData.owner_id && matchData.owner_id !== playerId) {
    const tpl = NOTIFICATION_TEMPLATES.player_joined(playerName, "tu partido");
    await createNotification(supabase, {
      user_id: matchData.owner_id,
      type: "player_joined",
      title: tpl.title,
      body: tpl.body,
      match_id: matchId,
    });
  }

  revalidatePath("/buscar-partido");
  revalidatePath("/feed");
  revalidatePath("/comunidad/para-ti");
  revalidatePath("/partidos");
  revalidatePath("/home");
  return { success: true, message: "Te uniste al partido. El pago lo coordinás con el organizador." };
}
