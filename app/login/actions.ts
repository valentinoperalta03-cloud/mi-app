"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
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
  const email = getStringField(formData, "email");
  const password = getStringField(formData, "password");

  if (!email || !password) {
    loginRedirect("Completa email y contrasena.");
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

  redirect("/feed");
}

export async function signUpWithEmail(formData: FormData) {
  const fullName = getStringField(formData, "full_name");
  const email = getStringField(formData, "email");
  const password = getStringField(formData, "password");

  if (!fullName || !email || !password) {
    loginRedirect("Completa nombre, email y contrasena.");
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
    loginRedirect(formatAuthErrorMessage(error.message));
  }

  if (data.session) {
    redirect("/feed");
  }

  const params = new URLSearchParams();
  params.set("kind", "info");
  params.set(
    "message",
    "Revisa tu email para confirmar la cuenta. Luego podes iniciar sesion."
  );
  redirect(`/login?${params.toString()}`);
}

