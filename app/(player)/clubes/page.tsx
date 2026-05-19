import { Suspense } from "react";
import MotionPage from "@/components/motion-page";
import ClubsListClient, { type ClubRow } from "@/components/clubs-list-client";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

/**
 * Columnas que existen en `public.clubs` (sin latitude/longitude: no están en el schema actual).
 * Pedir columnas inexistentes hace que PostgREST responda 400.
 */
const CLUBS_LIST_SELECT =
  "id,name,location,cover_image_url,logo_url,description,business_hours";

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

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(DB_TABLES.clubs)
      .select(CLUBS_LIST_SELECT)
      .eq("is_active", true);

    console.log("[clubes] Supabase response", { data, error });

    if (error) {
      errorMessage = "No se pudieron cargar los clubes. Intenta nuevamente.";
      errorDebug =
        [error.message, error.details, error.hint, error.code].filter(Boolean).join(" — ") ||
        JSON.stringify(error);
    } else {
      clubs = (data as ClubRow[]) ?? [];
    }
  } catch (e) {
    console.error("[clubes] ClubesContent exception", e);
    errorMessage = "Error inesperado al cargar clubes.";
    errorDebug = e instanceof Error ? e.message : String(e);
  }

  return <ClubsListClient clubs={clubs} errorMessage={errorMessage} errorDebug={errorDebug} />;
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
