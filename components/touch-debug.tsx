"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * TEMPORAL: muestra puntos rojos donde se registran los toques en Android.
 * Esto nos dice si hay offset de coordenadas o si los toques no llegan al JS.
 * Remover cuando el bug esté resuelto.
 */
export default function TouchDebug() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    function onTouch(e: TouchEvent) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      if (!touch) return;

      const x = touch.clientX;
      const y = touch.clientY;
      const W = window.innerWidth;
      const H = window.innerHeight;

      const dot = document.createElement("div");
      dot.style.cssText = [
        "position:fixed",
        `left:${x - 18}px`,
        `top:${y - 18}px`,
        "width:36px",
        "height:36px",
        "border-radius:50%",
        "background:rgba(255,30,30,0.85)",
        "border:2px solid #fff",
        "z-index:99999",
        "pointer-events:none",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "font-size:8px",
        "font-weight:bold",
        "color:#fff",
        "line-height:1",
        "text-align:center",
      ].join(";");
      dot.textContent = `${Math.round(x)},${Math.round(y)}`;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 2000);

      // Banner inferior con info de la pantalla
      const banner = document.getElementById("__touch_dbg_banner") ?? (() => {
        const b = document.createElement("div");
        b.id = "__touch_dbg_banner";
        b.style.cssText = [
          "position:fixed",
          "bottom:0",
          "left:0",
          "right:0",
          "z-index:99999",
          "pointer-events:none",
          "background:rgba(0,0,0,0.75)",
          "color:#0f0",
          "font-size:10px",
          "padding:4px 8px",
          "font-family:monospace",
        ].join(";");
        document.body.appendChild(b);
        return b;
      })();
      banner.textContent = `touch(${Math.round(x)},${Math.round(y)}) | screen ${W}×${H} | safe-b:${getComputedStyle(document.documentElement).getPropertyValue("--cap-safe-bottom").trim() || "?"}`;
    }

    document.addEventListener("touchstart", onTouch, { passive: true, capture: true });
    return () => document.removeEventListener("touchstart", onTouch, { capture: true });
  }, []);

  return null;
}
