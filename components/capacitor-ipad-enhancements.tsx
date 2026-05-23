"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { isCapacitorIosIpad } from "@/lib/capacitor-device";

/**
 * Clase html.capacitor-ipad + ajuste de scroll cuando el teclado flota en iPad.
 * No afecta iPhone ni web.
 */
export default function CapacitorIpadEnhancements() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    const applyIpadClass = () => {
      if (isCapacitorIosIpad()) {
        root.classList.add("capacitor-ipad");
      } else {
        root.classList.remove("capacitor-ipad");
      }
    };

    applyIpadClass();

    const vv = window.visualViewport;
    const updateKeyboardInset = () => {
      if (!isCapacitorIosIpad() || !vv) {
        root.style.removeProperty("--keyboard-inset");
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--keyboard-inset", `${inset}px`);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isCapacitorIosIpad()) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 320);
    };

    updateKeyboardInset();
    vv?.addEventListener("resize", updateKeyboardInset);
    vv?.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("resize", applyIpadClass);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      root.classList.remove("capacitor-ipad");
      root.style.removeProperty("--keyboard-inset");
      vv?.removeEventListener("resize", updateKeyboardInset);
      vv?.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("resize", applyIpadClass);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  return null;
}
