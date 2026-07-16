"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function AdminSignOutLink() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleSignOut()}
      className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut size={15} />
      {busy ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
