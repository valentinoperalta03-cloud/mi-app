"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PLAYER_SHELL_ROUTES,
  prefetchPlayerHomeData,
} from "@/lib/player-route-prefetch";

/** Precarga RSC de tabs player + datos del home en el mismo request. */
export default function PlayerRoutePrefetch() {
  const router = useRouter();

  useEffect(() => {
    prefetchPlayerHomeData();

    for (const route of PLAYER_SHELL_ROUTES) {
      try {
        router.prefetch(route);
      } catch {
        // Prefetch no disponible en algunos entornos de preview.
      }
    }
  }, [router]);

  return null;
}
