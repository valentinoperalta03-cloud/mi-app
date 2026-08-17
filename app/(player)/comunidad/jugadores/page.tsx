import { redirect } from "next/navigation";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { fetchComunidadPlayersData } from "@/lib/comunidad-players-data";
import { createClient } from "@/utils/supabase/server";
import JugadoresClient from "./jugadores-client";

export default async function JugadoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { players, initialFollowingIds, followsMeIds } = await fetchComunidadPlayersData(
    supabase,
    user.id
  );

  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-transparent pb-32 pt-5">
      <div className="px-4">
        <PlayerStackHeader
          backHref="/comunidad"
          backLabel="Volver a Comunidad"
          title="Jugadores"
          subtitle="Buscá y seguí a otros jugadores"
        />

        {players.length === 0 ? (
          <EmptyStateCard
            icon="users"
            title="No encontramos jugadores"
            subtitle="Probá con otro nombre o esperá que más jugadores se sumen"
          />
        ) : (
          <JugadoresClient
            players={players}
            initialFollowingIds={initialFollowingIds}
            followsMeIds={followsMeIds}
            currentUserId={user.id}
          />
        )}
      </div>
    </MotionPage>
  );
}
