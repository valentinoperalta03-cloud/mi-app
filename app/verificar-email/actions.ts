"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type VerifyResult = {
  success: boolean;
  message: string;
};

export async function verifyEmailOtp(email: string, token: string): Promise<VerifyResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolvedEmail = user?.email ?? email;
  if (!resolvedEmail || !token) {
    return { success: false, message: "Código incorrecto o expirado." };
  }

  const { error } = await supabase.auth.verifyOtp({
    email: resolvedEmail,
    token,
    type: "signup",
  });

  if (error) {
    return { success: false, message: "Código incorrecto o expirado." };
  }

  redirect("/home");
}

export async function resendEmailOtp(email: string): Promise<VerifyResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return { success: false, message: "No se pudo reenviar el código." };
  }

  return { success: true, message: "Código reenviado." };
}
