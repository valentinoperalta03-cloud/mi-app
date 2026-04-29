"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveHomePath } from "@/lib/auth-redirect";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { createClient } from "@/utils/supabase/server";

function getStringField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getAppOrigin(): Promise<string> {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    h.get("origin") ??
    "http://localhost:3000"
  );
}

function loginRedirect(message: string, isError = true): never {
  const params = new URLSearchParams();
  params.set("message", message);
  if (isError) params.set("kind", "error");
  redirect(`/login?${params.toString()}`);
}

export async function signInWithEmail(formData: FormData) {
  const email = sanitizeText(getStringField(formData, "email"), 320).toLowerCase();
  const password = getStringField(formData, "password");

  if (!email || !password) {
    loginRedirect("Completa email y contrasena.");
  }

  const allowed = await checkRateLimit(`login:${email}`, 10, 300);
  if (!allowed) {
    loginRedirect("Demasiados intentos. Esperá 5 minutos.");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    loginRedirect(formatAuthErrorMessage(error.message));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    loginRedirect("No se pudo obtener la sesion. Volve a intentar.");
  }

  redirect(await resolveHomePath(supabase, user.id));
}

export type SignUpWithEmailResult =
  | { step: "otp"; email: string }
  | { step: "error"; message: string };

export type OtpActionResult = {
  success: boolean;
  message: string;
};

export async function signUpWithEmail(formData: FormData): Promise<SignUpWithEmailResult> {
  const fullName = sanitizeText(getStringField(formData, "full_name"), 120);
  const email = sanitizeText(getStringField(formData, "email"), 320).toLowerCase();
  const password = getStringField(formData, "password");

  if (!fullName || !email || !password) {
    return { step: "error", message: "Completa nombre, email y contrasena." };
  }

  const origin = await getAppOrigin();
  const supabase = await createClient({ allowCookieWrites: true });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { step: "error", message: formatAuthErrorMessage(error.message) };
  }

  if (data.session) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (u) {
      redirect(await resolveHomePath(supabase, u.id));
    }
  }

  return { step: "otp", email };
}

export async function verifyOtpCode(formData: FormData): Promise<OtpActionResult> {
  const email = getStringField(formData, "email");
  const token = getStringField(formData, "token");

  if (!email || !token) {
    return { success: false, message: "Completá email y código." };
  }
  if (!/^\d{6}$/.test(token)) {
    return { success: false, message: "Ingresá un código de 6 dígitos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
  if (error) {
    return { success: false, message: "Código incorrecto o expirado. Revisá tu email." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "No se pudo obtener la sesión. Volvé a intentar." };
  }

  redirect(await resolveHomePath(supabase, user.id));
}

export async function resendOtpCode(formData: FormData): Promise<OtpActionResult> {
  const email = getStringField(formData, "email");
  if (!email) {
    return { success: false, message: "Ingresá un email válido para reenviar el código." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  if (error) {
    return { success: false, message: formatAuthErrorMessage(error.message) };
  }

  return { success: true, message: "Código reenviado. Revisá tu bandeja de entrada." };
}

