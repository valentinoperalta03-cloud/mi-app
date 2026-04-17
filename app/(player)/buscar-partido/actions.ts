"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
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
    .select("gender")
    .eq("user_id", playerId)
    .maybeSingle();
  if (profileError) {
    return {
      success: false,
      message: `No pudimos validar tu perfil: ${profileError.message}`,
    };
  }
  const playerGender = (profileRow as { gender?: "masculino" | "femenino" | null } | null)?.gender ?? null;

  if (intent === "leave") {
    const { error: deleteError } = await supabase
      .from(DB_TABLES.matchParticipants)
      .delete()
      .eq("match_id", matchId)
      .eq("player_id", playerId);

    if (deleteError) {
      return {
        success: false,
        message: `No pudimos sacarte del partido: ${deleteError.message}`,
      };
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

  revalidatePath("/buscar-partido");
  revalidatePath("/feed");
  revalidatePath("/comunidad/feed");
  revalidatePath("/partidos");
  revalidatePath("/home");
  return { success: true, message: "Te uniste al partido con exito." };
}
