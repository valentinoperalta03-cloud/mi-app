"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/utils/supabase/client";

export default function CapacitorSupabaseRefresh() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const supabase = createClient();
    let removeListener: (() => void) | undefined;

    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    }).then((listener) => {
      removeListener = () => listener.remove();
    });

    return () => removeListener?.();
  }, []);

  return null;
}
