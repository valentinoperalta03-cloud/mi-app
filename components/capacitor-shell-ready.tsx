"use client";

import { useEffect } from "react";

/** Avisa al splash nativo que el shell principal ya pintó (home, login, etc.). */
export default function CapacitorShellReady() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("capacitor-shell-ready"));
  }, []);

  return null;
}
