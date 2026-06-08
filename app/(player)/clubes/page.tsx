import { Suspense } from "react";

export const dynamic = "force-dynamic";
import MotionPage from "@/components/motion-page";
import ClubsListClient, { type ClubRow } from "@/components/clubs-list-client";
import { DB_TABLES } from "@/lib/db-tables";
import { formatCityLabel } from "@/lib/locations";
import { getUserCityServer } from "@/lib/locations-server";
import { PLAYER_CARD } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

type RpcClubRow = {
  id: string;
  name: string | null;
  location: string | null;
  city: string | null;
  address: string | null;
  image_url: string | null;
  logo_url: string | null;
  description: string | null;
  business_hours: string | null;
};

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

function mapRpcClub(row: RpcClubRow): ClubRow {
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? formatCityLabel(row.city),
    cover_image_url: row.image_url,
    logo_url: row.logo_url,
    description: row.description,
    business_hours: row.business_hours,
  };
}

async function ClubesContent() {
  let clubs: ClubRow[] = [];
  let errorMessage: string | null = null;
  let errorDebug: string | null = null;
  let userCity = "rosario";

  try {
    const supabase = await createClient();
    userCity = await getUserCityServer();

    const { data, error } = await supabase.rpc("get_clubs_by_city", { user_city: userCity });

    if (error) {
      const { data: fallback, error: fallbackError } = await supabase
        .from(DB_TABLES.clubs)
        .select("id,name,location,cover_image_url,logo_url,description,business_hours,city")
        .eq("is_active", true)
        .ilike("city", userCity);

      if (fallbackError) {
        errorMessage = "No se pudieron cargar los clubes. Intentá nuevamente.";
        errorDebug =
          [error.message, fallbackError.message].filter(Boolean).join(" — ") || JSON.stringify(error);
      } else {
        clubs = ((fallback ?? []) as ClubRow[]).map((club) => ({
          ...club,
          location: club.location ?? formatCityLabel(userCity),
        }));
      }
    } else {
      clubs = ((data ?? []) as RpcClubRow[]).map(mapRpcClub);
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
