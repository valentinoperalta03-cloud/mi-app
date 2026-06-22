"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { unlockControlPanelAction, type UnlockControlState } from "./actions";

const initialState: UnlockControlState = { success: false, message: "" };

export default function GateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(unlockControlPanelAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form
      action={formAction}
      className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <p className="text-sm font-medium text-[#0585FC]">Panel de Control</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Acceso protegido</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Ingresa la contrasena de administrador para ver facturacion e indicadores.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Contrasena de Administrador</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </label>

      {state.message ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100/60 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-gradient-to-r from-[#0585FC] to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Verificando..." : "Ingresar al Panel"}
      </button>
    </form>
  );
}
