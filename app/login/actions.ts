"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSafeNextPath } from "@/lib/auth-redirect";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { getAuthSiteOrigin } from "@/lib/auth-site-url";
import { DB_TABLES } from "@/lib/db-tables";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import { EXISTING_ACCOUNT_LOGIN_MESSAGE } from "./constants";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Como resolveHomePath (usado por proxy.ts para decidir isAdmin), pero para
 * el redirect post-login/signup: si el club recien registrado esta en
 * subscription_status = 'pending', manda directo a /admin/activacion en vez
 * de /admin/dashboard (que igual lo rebotaria ahi via el gate de suscripcion,
 * pero esto evita el salto extra). Vive aca (server-only) y no en
 * lib/auth-redirect.ts porque ese modulo tambien lo importa codigo cliente
 * (lib/native-oauth.ts) y no puede arrastrar createServiceClient/next-headers.
 */
async function resolveLoginRedirectPath(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: ownedClub } = await supabase
    .from(DB_TABLES.clubs)
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  const clubId = String((ownedClub as { id?: string } | null)?.id ?? "").trim();
  if (!clubId) return "/home";

  // subscription_status esta revocada para authenticated: se lee con service client.
  const { data: statusRow } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("subscription_status")
    .eq("id", clubId)
    .maybeSingle();
  const status = (statusRow as { subscription_status?: string | null } | null)?.subscription_status;

  return status === "pending" ? "/admin/activacion" : "/admin/dashboard";
}

function getStringField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getAppOrigin(): Promise<string> {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    h.get("origin")?.replace(/\/$/, "") ??
    getAuthSiteOrigin()
  );
}

function loginRedirect(message: string, isError = true): never {
  const params = new URLSearchParams();
  params.set("message", message);
  if (isError) params.set("kind", "error");
  redirect(`/login?${params.toString()}`);
}

export type SignInWithEmailResult = {
  ok: false;
  message: string;
  needsEmailVerification?: boolean;
  email?: string;
};

export async function signInWithEmail(
  formData: FormData
): Promise<SignInWithEmailResult> {
  const email = sanitizeText(getStringField(formData, "email"), 320).toLowerCase();
  const password = getStringField(formData, "password");

  if (!email || !password) {
    return { ok: false, message: "Completá email y contraseña." };
  }

  const allowed = await checkRateLimit(`login:${email}`, 10, 300);
  if (!allowed) {
    return { ok: false, message: "Demasiados intentos. Esperá 5 minutos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = formatAuthErrorMessage(error.message);
    if (error.message.toLowerCase().includes("email not confirmed")) {
      await supabase.auth.resend({ type: "signup", email }).catch(() => undefined);
      return {
        ok: false,
        message:
          "Tu email no está confirmado. Te enviamos un código nuevo — revisá tu bandeja (y spam).",
        needsEmailVerification: true,
        email,
      };
    }
    return { ok: false, message: msg };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "No se pudo obtener la sesión. Volvé a intentar." };
  }

  const next = resolveSafeNextPath(getStringField(formData, "next"));
  redirect(next ?? (await resolveLoginRedirectPath(supabase, user.id)));
}

export type SignUpWithEmailResult =
  | { step: "otp"; email: string }
  | { step: "error"; message: string; needsLogin?: boolean };

export type OtpActionResult = {
  success: boolean;
  message: string;
};

function isAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("user already registered") ||
    m.includes("already been registered")
  );
}

/** Supabase anti-enumeración: user sin identities = email ya registrado, sin mail nuevo. */
function isDuplicateSignupWithoutEmail(user: { identities?: { id: string }[] | null } | null): boolean {
  if (!user) return false;
  return (user.identities?.length ?? 0) === 0;
}

export async function signUpWithEmail(formData: FormData): Promise<SignUpWithEmailResult> {
  const fullName = sanitizeText(getStringField(formData, "full_name"), 120);
  const email = sanitizeText(getStringField(formData, "email"), 320).toLowerCase();
  const password = getStringField(formData, "password");

  if (!fullName || !email || !password) {
    return { step: "error", message: "Completá nombre, email y contraseña." };
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
    if (isAlreadyRegisteredError(error.message)) {
      return {
        step: "error",
        message: EXISTING_ACCOUNT_LOGIN_MESSAGE,
        needsLogin: true,
      };
    }
    return { step: "error", message: formatAuthErrorMessage(error.message) };
  }

  if (data.session) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (u) {
      const next = resolveSafeNextPath(getStringField(formData, "next"));
      redirect(next ?? (await resolveLoginRedirectPath(supabase, u.id)));
    }
  }

  if (!data.user) {
    return {
      step: "error",
      message:
        "No se pudo crear la cuenta. Revisá el email o intentá de nuevo en unos minutos.",
    };
  }

  if (isDuplicateSignupWithoutEmail(data.user)) {
    return {
      step: "error",
      message: EXISTING_ACCOUNT_LOGIN_MESSAGE,
      needsLogin: true,
    };
  }

  return { step: "otp", email };
}

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

export async function verifyOtpCode(formData: FormData): Promise<OtpActionResult> {
  const email = getStringField(formData, "email").toLowerCase();
  const token = getStringField(formData, "token");

  if (!email || !token) {
    return { success: false, message: "Completá email y código." };
  }
  if (!/^\d{6}$/.test(token)) {
    return { success: false, message: "Ingresá un código de 6 dígitos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const { error } = await verifyOtpWithFallback(supabase, email, token);
  if (error) {
    return {
      success: false,
      message: formatAuthErrorMessage(
        error.message || "Código incorrecto o expirado. Revisá tu email."
      ),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "No se pudo obtener la sesión. Volvé a intentar." };
  }

  const next = resolveSafeNextPath(getStringField(formData, "next"));
  redirect(next ?? (await resolveLoginRedirectPath(supabase, user.id)));
}

export async function resendOtpCode(formData: FormData): Promise<OtpActionResult> {
  const email = getStringField(formData, "email").toLowerCase();
  if (!email) {
    return { success: false, message: "Ingresá un email válido para reenviar el código." };
  }

  const allowed = await checkRateLimit(`otp-resend:${email}`, 5, 300);
  if (!allowed) {
    return { success: false, message: "Demasiados reenvíos. Esperá 5 minutos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  if (error) {
    return { success: false, message: formatAuthErrorMessage(error.message) };
  }

  return {
    success: true,
    message: "Código reenviado. Revisá tu bandeja de entrada y la carpeta de spam.",
  };
}
