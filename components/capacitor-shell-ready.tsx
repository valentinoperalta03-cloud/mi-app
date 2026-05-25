"use client";

import { useEffect } from "react";

/**
 * Avisa al splash nativo que el shell principal ya pintó (home, login, etc.).
 * No renderiza DOM: no puede bloquear scroll ni capturar eventos táctiles.
 */
export default function CapacitorShellReady() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("capacitor-shell-ready"));
  }, []);

  return null;
}
