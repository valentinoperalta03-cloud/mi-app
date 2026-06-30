"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export default function CapacitorExternalLinks() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (!href.startsWith("http://") && !href.startsWith("https://")) return;

      try {
        const url = new URL(href);
        if (url.hostname === "padelibre.online" || url.hostname.endsWith(".padelibre.online")) return;
      } catch {
        return;
      }

      e.preventDefault();
      void Browser.open({ url: href });
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
