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
      className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <p className="text-sm font-medium text-[#0585FC]">Panel de Control</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Acceso protegido</h2>
        <p className="mt-2 text-sm text-slate-500">
          Ingresa la contrasena de administrador para ver facturacion e indicadores.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Contrasena de Administrador</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
        />
      </label>

      {state.message ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
