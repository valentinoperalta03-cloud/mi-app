"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";

export function TournamentRealtimeRefresh({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    function subscribe() {
      return supabase
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
    }

    let channel = subscribe();
    let cleanupNetwork: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      void Network.addListener("networkStatusChange", (status) => {
        if (!status.connected) return;
        void supabase.removeChannel(channel).then(() => {
          channel = subscribe();
        });
      }).then((handle) => {
        cleanupNetwork = () => void handle.remove();
      });
    }

    return () => {
      void supabase.removeChannel(channel);
      cleanupNetwork?.();
    };
  }, [tournamentId, router]);

  return null;
}
