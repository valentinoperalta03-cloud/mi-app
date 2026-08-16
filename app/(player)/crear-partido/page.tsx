import { Suspense } from "react";

export const dynamic = "force-dynamic";
import MotionPage from "@/components/motion-page";
import ClubsListClient, { type ClubRow } from "@/components/clubs-list-client";
import { DB_TABLES } from "@/lib/db-tables";
import { normalizeCity } from "@/lib/locations";
import { PLAYER_CARD } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

const HOW_IT_WORKS_BULLETS = [
  "Abrís un partido en el club que elijas",
  "Otros jugadores de tu nivel se unen",
  "Al completarse los 4, el último paga la seña y confirma la cancha para todos",
];

const BULLET_NUMBERS = ["①", "②", "③"];

function HowItWorksCard() {
  return (
    <div className="rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0085FC]/10 text-lg">
          🎾
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--text-primary)]">¿Qué es un partido abierto?</p>
          <div className="mt-2 space-y-1.5">
            {HOW_IT_WORKS_BULLETS.map((bullet, i) => (
              <p key={bullet} className="flex gap-2 text-sm text-[var(--text-tertiary)]">
                <span className="shrink-0 font-mono text-[#CCFF00]">{BULLET_NUMBERS[i]}</span>
                <span>{bullet}</span>
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]/60">
            La seña se cobra por Mercado Pago al completarse el grupo
          </p>
        </div>
      </div>
    </div>
  );
}

function CrearPartidoLoading() {
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

async function CrearPartidoContent() {
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

    const [{ data, error }, { data: availability }] = await Promise.all([
      supabase
        .from(DB_TABLES.clubs)
        .select("id,name,slug,location,cover_image_url,logo_url,description,business_hours,city,province")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      // get_clubs_availability ya combina subscription_status, onboarding_completed
      // y mp_access_token en un solo booleano (columnas revocadas para anon/authenticated).
      supabase.rpc("get_clubs_availability"),
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
      // get_clubs_availability ya excluye del WHERE los clubes en 'pending': si un
      // club no aparece ahi, no debe listarse (no solo marcarse "no disponible").
      clubs = ((data ?? []) as ClubRow[])
        .filter((club) => String(club.id) in availabilityMap)
        .map((club) => ({
          ...club,
          isAvailable: availabilityMap[String(club.id)],
        }));
    }
  } catch (e) {
    console.error("[crear-partido] CrearPartidoContent exception", e);
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
      title="Crear partido"
      subtitle="Elegí un club para abrir tu partido"
      headerExtra={<HowItWorksCard />}
    />
  );
}

export default function CrearPartidoPage() {
  return (
    <Suspense fallback={<CrearPartidoLoading />}>
      <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
        <CrearPartidoContent />
      </MotionPage>
    </Suspense>
  );
}
