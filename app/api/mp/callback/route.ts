import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

function redirectUri(): string {
  const explicit = process.env.MP_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/mp/callback`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const configUrl = origin ? `${origin}/admin/config` : "/admin/config";

  if (err) {
    return NextResponse.redirect(`${configUrl}?mp=error`);
  }
  if (!code) {
    return NextResponse.redirect(`${configUrl}?mp=sin_codigo`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options: opts }) =>
            cookieStore.set(name, value, opts)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = origin ? `${origin}/login` : "/login";
    return NextResponse.redirect(`${login}?message=mercadopago`);
  }

  const clubId = state?.trim();
  if (!clubId) {
    return NextResponse.redirect(`${configUrl}?mp=sin_club`);
  }

  const { data: club, error: clubErr } = await supabase
    .from(DB_TABLES.clubs)
    .select("id, owner_id")
    .eq("id", clubId)
    .maybeSingle();

  if (clubErr || !club || (club as { owner_id: string | null }).owner_id !== user.id) {
    return NextResponse.redirect(`${configUrl}?mp=no_autorizado`);
  }

  const clientId = process.env.MP_APP_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${configUrl}?mp=config`);
  }

  const uri = redirectUri();
  let tokenJson: { access_token?: string; user_id?: string; message?: string };
  try {
    const res = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: uri,
        grant_type: "authorization_code",
      }),
    });
    tokenJson = (await res.json().catch(() => ({}))) as typeof tokenJson;
    if (!res.ok || !tokenJson.access_token) {
      console.error("[mp] oauth token", tokenJson);
      return NextResponse.redirect(`${configUrl}?mp=token_error`);
    }
  } catch (e) {
    console.error("[mp] oauth fetch", e);
    return NextResponse.redirect(`${configUrl}?mp=red_error`);
  }

  const serviceClient = createServiceClient();
  const { error: updErr } = await serviceClient
    .from(DB_TABLES.clubs)
    .update({
      mp_access_token: tokenJson.access_token,
      mp_user_id: tokenJson.user_id != null ? String(tokenJson.user_id) : null,
    })
    .eq("id", clubId)
    .eq("owner_id", user.id);

  if (updErr) {
    console.error("[mp] club update", updErr);
    return NextResponse.redirect(`${configUrl}?mp=db_error`);
  }

  return NextResponse.redirect(`${configUrl}?mp=ok`);
}
