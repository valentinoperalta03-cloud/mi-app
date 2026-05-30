"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { pickTeamForMatch } from "@/lib/match-teams";
import { createClient, createServiceClient } from "@/utils/supabase/server";

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

export type JoinMatchActionState = {
  success: boolean;
  message: string;
};

const initialState: JoinMatchActionState = { success: false, message: "" };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function joinMatchAction(
  prevState: JoinMatchActionState = initialState,
  formData: FormData
): Promise<JoinMatchActionState> {
  void prevState;

  const matchId = getField(formData, "match_id");
  const userId = getField(formData, "user_id");

  if (!matchId || !userId) {
    return { success: false, message: "Datos incompletos para unirte al partido." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Necesitas iniciar sesion para unirte." };
  }

  if (user.id !== userId) {
    return { success: false, message: "No autorizado para unirte con ese usuario." };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from(DB_TABLES.profiles)
    .select("gender")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) {
    return {
      success: false,
      message: `No pudimos validar tu perfil: ${profileError.message}`,
    };
  }
  const playerGender = (profileRow as { gender?: "masculino" | "femenino" | null } | null)?.gender ?? null;

  const { data: joinedRow, error: joinedError } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("match_id", matchId)
    .eq("player_id", userId)
    .maybeSingle();

  if (joinedError) {
    return {
      success: false,
      message: `No pudimos validar tu inscripcion: ${joinedError.message}`,
    };
  }

  if (joinedRow) {
    return { success: false, message: "Ya estas unido a este partido." };
  }

  const { data: matchRow, error: matchError } = await supabase
    .from(DB_TABLES.matches)
    .select("gender_category")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError || !matchRow) {
    return {
      success: false,
      message: `No pudimos validar el partido: ${matchError?.message ?? "partido inexistente"}`,
    };
  }
  const genderCategory =
    (matchRow as { gender_category?: "masculino" | "femenino" | "mixto" | null }).gender_category ?? "mixto";
  if (genderCategory !== "mixto" && playerGender !== genderCategory) {
    const categoryLabel = genderCategory === "masculino" ? "Masculino" : "Femenino";
    return { success: false, message: `Este partido es exclusivo para ${categoryLabel}.` };
  }

  const { data: players, error: playersError } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId);

  if (playersError) {
    return {
      success: false,
      message: `No pudimos validar cupos: ${playersError.message}`,
    };
  }

  if ((players?.length ?? 0) >= 4) {
    return { success: false, message: "Este partido ya no tiene cupos libres." };
  }

  const pickedTeam = await pickTeamForMatch(supabase, matchId);
  if (pickedTeam == null) {
    return { success: false, message: "Este partido ya no tiene cupos libres." };
  }

  const { error: insertError } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: matchId,
    player_id: userId,
    team: pickedTeam,
  });

  if (insertError) {
    return {
      success: false,
      message: `No se pudo completar la inscripcion: ${insertError.message}`,
    };
  }
  await addPlayerToMatchGroup(supabase, matchId, userId);

  revalidatePath("/buscar-partido");
  revalidatePath("/comunidad/para-ti");
  revalidatePath("/feed");
  revalidatePath("/home");
  return { success: true, message: "Te uniste al partido con exito." };
}
