import { Suspense } from "react";

export const dynamic = "force-dynamic";
import MotionPage from "@/components/motion-page";
import ClubsListClient, { type ClubRow } from "@/components/clubs-list-client";
import { DB_TABLES } from "@/lib/db-tables";
import { normalizeCity } from "@/lib/locations";
import { PLAYER_CARD } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

function ClubesLoading() {
  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
      <div className="shimmer h-8 w-44 rounded-xl" />
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className={`${PLAYER_CARD} p-4`}>
          <div className="flex items-center gap-4">
            <div className="shimmer h-16 w-16 rounded-2xl" />
            <div className="flex-1">
              <div className="shimmer h-5 w-3/4 rounded-md" />
              <div className="mt-3 shimmer h-4 w-1/2 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </MotionPage>
  );
}

async function ClubesContent() {
  let clubs: ClubRow[] = [];
  let errorMessage: string | null = null;
  let errorDebug: string | null = null;
  let userCity = "";
  let userProvince = "";

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from(DB_TABLES.profiles)
        .select("city, province")
        .eq("user_id", user.id)
        .maybeSingle();
      const typedProfile = profile as { city?: string | null; province?: string | null } | null;
      userCity = typedProfile?.city?.trim() ? normalizeCity(typedProfile.city) : "";
      userProvince = typedProfile?.province?.trim() ?? "";
    }

    const [{ data, error }, { data: availability }, { data: mpConnectedRaw }] = await Promise.all([
      supabase
        .from(DB_TABLES.clubs)
        .select("id,name,location,cover_image_url,logo_url,description,business_hours,city,province")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase.rpc("get_clubs_availability"),
      // mp_access_token esta revocada para anon/authenticated: se pregunta via RPC
      // que solo expone el booleano de conexion, nunca el token.
      supabase.rpc("get_clubs_mp_connected"),
    ]);

    if (error) {
      errorMessage = "No se pudieron cargar los clubes. Intentá nuevamente.";
      errorDebug = error.message;
    } else {
      const availabilityMap = Object.fromEntries(
        ((availability ?? []) as Array<{ club_id: string; is_available: boolean }>).map((a) => [
          a.club_id,
          a.is_available,
        ])
      );
      const mpConnectedMap = Object.fromEntries(
        ((mpConnectedRaw ?? []) as Array<{ club_id: string; mp_connected: boolean }>).map((m) => [
          m.club_id,
          m.mp_connected,
        ])
      );
      clubs = ((data ?? []) as ClubRow[]).map((club) => ({
        ...club,
        isAvailable: availabilityMap[String(club.id)] ?? true,
        mpConnected: mpConnectedMap[String(club.id)] ?? false,
      }));
    }
  } catch (e) {
    console.error("[clubes] ClubesContent exception", e);
    errorMessage = "Error inesperado al cargar clubes.";
    errorDebug = e instanceof Error ? e.message : String(e);
  }

  return (
    <ClubsListClient
      clubs={clubs}
      userCity={userCity}
      userProvince={userProvince}
      errorMessage={errorMessage}
      errorDebug={errorDebug}
    />
  );
}

export default function ClubesPage() {
  return (
    <Suspense fallback={<ClubesLoading />}>
      <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
        <ClubesContent />
      </MotionPage>
    </Suspense>
  );
}
