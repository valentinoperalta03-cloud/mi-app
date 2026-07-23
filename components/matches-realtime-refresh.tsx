"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";

/**
 * Refresca la ruta actual cuando cambia una fila de `matches` que matchea
 * `filter` (ej. el webhook de MP confirma un pago). Mismo patron que
 * TournamentRealtimeRefresh — reconecta el canal si vuelve la red en nativo.
 */
export function MatchesRealtimeRefresh({ channelName, filter }: { channelName: string; filter: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    function subscribe() {
      return supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: DB_TABLES.matches, filter },
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
  }, [channelName, filter, router]);

  return null;
}
