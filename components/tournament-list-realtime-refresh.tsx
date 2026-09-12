"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";

/** Refresca /torneos cuando cambia el status de cualquier torneo (cancelado, cerrado, reabierto, iniciado). */
export function TournamentListRealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    function subscribe() {
      return supabase
        .channel("tournaments-list-live")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: DB_TABLES.tournaments },
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
  }, [router]);

  return null;
}
