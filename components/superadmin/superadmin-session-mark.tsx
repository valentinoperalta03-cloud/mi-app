"use client";

import { useEffect } from "react";

/** Marca en sessionStorage que el PIN ya fue validado (UX; la autoridad real es la cookie httpOnly). */
export default function SuperadminSessionMark() {
  useEffect(() => {
    try {
      sessionStorage.setItem("padelibre_superadmin_unlocked", "1");
    } catch {
      /* */
    }
  }, []);
  return null;
}
