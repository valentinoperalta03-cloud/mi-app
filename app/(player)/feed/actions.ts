"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

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

  const { data: joinedRow, error: joinedError } = await supabase
    .from(DB_TABLES.matchPlayers)
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

  const { data: players, error: playersError } = await supabase
    .from(DB_TABLES.matchPlayers)
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

  const { error: insertError } = await supabase.from(DB_TABLES.matchPlayers).insert({
    match_id: matchId,
    player_id: userId,
  });

  if (insertError) {
    return {
      success: false,
      message: `No se pudo completar la inscripcion: ${insertError.message}`,
    };
  }

  revalidatePath("/buscar-partido");
  revalidatePath("/comunidad/feed");
  revalidatePath("/feed");
  revalidatePath("/home");
  return { success: true, message: "Te uniste al partido con exito." };
}
