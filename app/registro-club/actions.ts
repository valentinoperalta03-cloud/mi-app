"use server";

import { DB_TABLES } from "@/lib/db-tables";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { sanitizeText } from "@/lib/sanitize";
import { generateSlug } from "@/lib/slug";
import { createClient, createServiceClient } from "@/utils/supabase/server";

export type ClubOtpResult = { success: true } | { success: false; message: string };

/** Genera un slug único agregando un sufijo numérico si ya existe (ej. "mi-club" -> "mi-club-2"). */
async function generateUniqueSlug(
  supabase: ReturnType<typeof createServiceClient>,
  clubName: string
): Promise<string> {
  const base = generateSlug(clubName) || "club";
  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data: existing } = await supabase
      .from(DB_TABLES.clubs)
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/** Solo se llama server-side, tras verificar el OTP en la misma request: nunca se expone al cliente. */
async function registerClubAction(userId: string, clubName: string) {
  const supabase = createServiceClient();
  const slug = await generateUniqueSlug(supabase, clubName);

  const { data: club, error } = await supabase
    .from(DB_TABLES.clubs)
    .insert({
      owner_id: userId,
      name: clubName,
      slug,
      is_active: true,
      onboarding_completed: false,
      subscription_status: "pending",
    })
    .select("id")
    .single();

  if (error) throw error;
  return club as { id: string };
}

export async function verifyClubOtpAction(formData: FormData): Promise<ClubOtpResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();
  const clubName = sanitizeText(String(formData.get("club_name") ?? ""), 120);

  if (!email || !token || !clubName) {
    return { success: false, message: "Faltan datos para completar el registro." };
  }
  if (!/^\d{6}$/.test(token)) {
    return { success: false, message: "Ingresá un código de 6 dígitos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });

  const signupAttempt = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  const { error } = signupAttempt.error
    ? await supabase.auth.verifyOtp({ email, token, type: "email" })
    : signupAttempt;

  if (error) {
    return {
      success: false,
      message: formatAuthErrorMessage(error.message || "Código incorrecto o expirado. Revisá tu email."),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "No se pudo obtener la sesión. Volvé a intentar." };
  }

  try {
    await registerClubAction(user.id, clubName);
  } catch {
    return { success: false, message: "No se pudo crear el club. Contactá a soporte." };
  }

  return { success: true };
}
