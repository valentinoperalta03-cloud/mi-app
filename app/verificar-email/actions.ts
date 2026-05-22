"use server";

import { redirect } from "next/navigation";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/utils/supabase/server";

type VerifyResult = {
  success: boolean;
  message: string;
};

async function verifyOtpWithFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
  token: string
) {
  const signupAttempt = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
  if (!signupAttempt.error) {
    return signupAttempt;
  }

  return supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
}

export async function verifyEmailOtp(email: string, token: string): Promise<VerifyResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolvedEmail = (user?.email ?? email).trim().toLowerCase();
  if (!resolvedEmail || !token) {
    return { success: false, message: "Completá el código de 6 dígitos." };
  }
  if (!/^\d{6}$/.test(token)) {
    return { success: false, message: "Ingresá un código de 6 dígitos." };
  }

  const { error } = await verifyOtpWithFallback(supabase, resolvedEmail, token);

  if (error) {
    return {
      success: false,
      message: formatAuthErrorMessage(
        error.message || "Código incorrecto o expirado."
      ),
    };
  }

  redirect("/home");
}

export async function resendEmailOtp(email: string): Promise<VerifyResult> {
  const resolvedEmail = email.trim().toLowerCase();
  if (!resolvedEmail) {
    return { success: false, message: "Ingresá un email válido." };
  }

  const allowed = await checkRateLimit(`otp-resend:${resolvedEmail}`, 5, 300);
  if (!allowed) {
    return { success: false, message: "Demasiados reenvíos. Esperá 5 minutos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: resolvedEmail,
  });

  if (error) {
    return { success: false, message: formatAuthErrorMessage(error.message) };
  }

  return {
    success: true,
    message: "Código reenviado. Revisá tu bandeja de entrada y spam.",
  };
}
