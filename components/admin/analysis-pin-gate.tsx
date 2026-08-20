"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { adminCTAPrimary } from "@/components/admin/admin-premium";

const STORAGE_KEY = "analysis_pin_ok";

function readUnlockedFromStorage(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

type Props = {
  clubId: string | null;
  children: ReactNode;
};

export default function AnalysisPinGate({ clubId, children }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata el desbloqueo desde sessionStorage tras montar (SSR no tiene window)
    if (readUnlockedFromStorage()) setUnlocked(true);
  }, []);

  function unlock() {
    setPinError(false);
    setPinInput("");
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode / quota */
    }
    setUnlocked(true);
  }

  async function tryPin(e: FormEvent) {
    e.preventDefault();
    if (!clubId) {
      if (pinInput === "1234") {
        unlock();
      } else {
        setPinError(true);
      }
      return;
    }
    setPinChecking(true);
    const supabase = createClient();
    // finance_pin nunca se manda al browser: la verificacion corre en Postgres via RPC.
    const { data: ok } = await supabase.rpc("verify_finance_pin", { p_club_id: clubId, p_pin: pinInput });
    setPinChecking(false);
    if (ok) {
      unlock();
    } else {
      setPinError(true);
    }
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-sm rounded-3xl border border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] p-8">
      <div className="mx-auto w-fit rounded-full bg-[var(--bg-subtle)] p-3">
        <Lock className="text-[var(--text-secondary)]" size={22} />
      </div>
      <h2 className="font-admin-display mt-4 text-center text-lg font-bold text-[var(--text-primary)]">
        Área protegida
      </h2>
      <p className="mt-1 text-center text-sm text-[var(--text-tertiary)]">
        Ingresá tu PIN para acceder a esta sección.
      </p>
      <form onSubmit={tryPin} className="mt-6 space-y-4">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pinInput}
          onChange={(e) => {
            setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6));
            setPinError(false);
          }}
          className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-center text-lg font-semibold tracking-widest outline-none transition-shadow focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20"
          placeholder="······"
          autoComplete="one-time-code"
        />
        {pinError ? <p className="text-center text-sm text-rose-600">PIN incorrecto.</p> : null}
        <button type="submit" disabled={pinChecking} className={`w-full ${adminCTAPrimary}`}>
          {pinChecking ? "Verificando..." : "Desbloquear"}
        </button>
      </form>
    </div>
  );
}
