"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function SignOutTextLink() {
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
      className="bg-transparent text-sm font-medium text-slate-500 underline decoration-transparent underline-offset-4 transition-colors hover:text-slate-700 hover:decoration-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
