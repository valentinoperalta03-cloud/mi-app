import { type NextRequest, NextResponse } from "next/server";
import { resolveHomePath } from "@/lib/auth-redirect";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const loginUrl = new URL("/login", requestUrl.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      loginUrl.searchParams.set("message", "No se pudo completar el login con Google.");
      return NextResponse.redirect(loginUrl);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      loginUrl.searchParams.set("message", "No se pudo obtener la sesión.");
      return NextResponse.redirect(loginUrl);
    }

    const target = await resolveHomePath(supabase, user.id);
    return NextResponse.redirect(new URL(target, requestUrl.origin));
  }

  loginUrl.searchParams.set("message", "Código OAuth inválido o faltante.");
  return NextResponse.redirect(loginUrl);
}
