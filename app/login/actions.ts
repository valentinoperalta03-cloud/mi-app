"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

function getStringField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function signInWithEmail(formData: FormData) {
  const email = getStringField(formData, "email");
  const password = getStringField(formData, "password");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signUpWithEmail(formData: FormData) {
  const email = getStringField(formData, "email");
  const password = getStringField(formData, "password");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Revisa tu email para confirmar la cuenta.");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    const message = error?.message ?? "No se pudo iniciar sesión con Google.";
    redirect(`/login?message=${encodeURIComponent(message)}`);
  }

  redirect(data.url);
}
