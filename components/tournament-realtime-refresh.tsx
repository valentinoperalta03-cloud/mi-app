"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";

export function TournamentRealtimeRefresh({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tournament-live:${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: DB_TABLES.tournamentRegistrations, filter: `tournament_id=eq.${tournamentId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: DB_TABLES.tournamentMatches, filter: `tournament_id=eq.${tournamentId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DB_TABLES.tournaments, filter: `id=eq.${tournamentId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  return null;
}
