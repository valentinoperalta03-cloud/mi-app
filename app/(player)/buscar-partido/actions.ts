"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification, NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { isLevelCompatible } from "@/lib/match-level";
import { createClient } from "@/utils/supabase/server";

export type ToggleJoinState = {
  success: boolean;
  message: string;
};

const initialState: ToggleJoinState = { success: false, message: "" };
const TOTAL_SLOTS = 4;

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

    const { error: deleteError } = await supabase
      .from(DB_TABLES.matchParticipants)
      .delete()
      .eq("match_id", matchId)
      .eq("player_id", playerId);
    if (deleteError) {
      return { success: false, message: `No pudimos sacarte del partido: ${deleteError.message}` };
    }

    const remainingIds = participantIds.filter((id) => id !== playerId);
    const isOwnerLeaving = leaveMatch.owner_id === playerId;
    if (isOwnerLeaving) {
      if (remainingIds.length === 0) {
        const { error: cancelErr } = await supabase
          .from(DB_TABLES.matches)
          .update({ match_status: "cancelled" })
          .eq("id", matchId);
        if (cancelErr) {
          return { success: false, message: "Saliste, pero no pudimos cerrar el partido automáticamente." };
        }
      } else {
        const newOwnerId = remainingIds[0];
        const { error: delegateErr } = await supabase
          .from(DB_TABLES.matches)
          .update({ owner_id: newOwnerId })
          .eq("id", matchId);
        if (delegateErr) {
          return { success: false, message: "Saliste, pero no pudimos reasignar organizador." };
        }
        const tplOwner = NOTIFICATION_TEMPLATES.match_owner_changed(leaveMatch.location_name ?? "el club");
        await createNotification(supabase, {
          user_id: newOwnerId,
          type: "match_owner_changed",
          title: tplOwner.title,
          body: tplOwner.body,
          match_id: matchId,
        });
      }
    }

    // Si la salida libera el turno (partido cancelado), limpiamos bloqueos manuales del horario.
    const { data: afterMatch } = await supabase
      .from(DB_TABLES.matches)
      .select("match_status,court_id,scheduled_date,scheduled_time")
      .eq("id", matchId)
      .maybeSingle();
    const afterStatus = String((afterMatch as { match_status?: string | null } | null)?.match_status ?? "").toLowerCase();
    const afterCourt = String((afterMatch as { court_id?: string | null } | null)?.court_id ?? "").trim();
    const afterDate = String((afterMatch as { scheduled_date?: string | null } | null)?.scheduled_date ?? "").trim();
    const afterTime = String((afterMatch as { scheduled_time?: string | null } | null)?.scheduled_time ?? "").trim().slice(0, 5);
    if (afterStatus === "cancelled" && afterCourt && afterDate && afterTime) {
      await supabase
        .from(DB_TABLES.courtBlocks)
        .delete()
        .eq("court_id", afterCourt)
        .eq("date", afterDate)
        .eq("start_time", afterTime);
    }

    const notifyIds = remainingIds.filter((id) => id !== playerId);
    const cancelTpl = NOTIFICATION_TEMPLATES.match_cancelled(leaveMatch.location_name ?? "el club");
    for (const uid of notifyIds) {
      await createNotification(supabase, {
        user_id: uid,
        type: "match_cancelled",
        title: cancelTpl.title,
        body: isOwnerLeaving
          ? remainingIds.length === 0
            ? cancelTpl.body
            : "El creador salió del partido y se reasignó un nuevo organizador."
          : `${playerName} salió del partido.`,
        match_id: matchId,
      });
    }

    revalidatePath("/buscar-partido");
    revalidatePath("/feed");
    revalidatePath("/comunidad/feed");
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

  const turnPrice = Number(matchData.total_price ?? 0);
  if (turnPrice > 0) {
    const share = Math.round((turnPrice / 4) * 100) / 100;
    return {
      success: false,
      message: `Para unirte debés abonar tu parte ($${share}). Hacé click en 'Pagar y unirse'.`,
    };
  }

  const { error: insertError } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: matchId,
    player_id: playerId,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { success: false, message: "Ya estabas anotado en este partido." };
    }
    return {
      success: false,
      message: `No se pudo completar la inscripcion: ${insertError.message}`,
    };
  }

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
  revalidatePath("/comunidad/feed");
  revalidatePath("/partidos");
  revalidatePath("/home");
  return { success: true, message: "Te uniste al partido con exito." };
}
