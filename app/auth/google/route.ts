import { type NextRequest } from "next/server";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { getAuthSiteOrigin } from "@/lib/auth-site-url";
import { createSupabaseRouteHandlerClient } from "@/utils/supabase/route-handler";

export async function GET(request: NextRequest) {
  const origin = getAuthSiteOrigin() || new URL(request.url).origin;
  const redirectTo = `${origin}/auth/callback`;

  const { supabase, redirectWithCookies } = createSupabaseRouteHandlerClient(request);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("kind", "error");
    loginUrl.searchParams.set("message", formatAuthErrorMessage(error.message));
    return redirectWithCookies(loginUrl);
  }

  if (!data.url) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("kind", "error");
    loginUrl.searchParams.set("message", "No se pudo iniciar sesión con Google.");
    return redirectWithCookies(loginUrl);
  }

  return redirectWithCookies(data.url);
}
