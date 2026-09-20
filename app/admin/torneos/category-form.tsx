"use client";

import { useState } from "react";
import { adminButtonSecondary, adminCTAPrimary } from "@/components/admin/admin-premium";
import { formatLevel } from "@/lib/tournament/v2/categories";
import type { CategoryInput } from "@/lib/tournament/v2/category-input";

/**
 * Formulario de una categoría — compartido entre la creación rápida de
 * torneo (torneo-form.tsx, N categorías antes de crear) y el Centro de
 * Torneo (categories-panel.tsx, agregar/editar categorías después de creado).
 * No depende de nada específico de ninguno de los dos flujos.
 */
export const LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export function emptyCategoryInput(): CategoryInput {
  return {
    name: "",
    modality: null,
    categoryKind: "traditional",
    levels: [8],
    sumaTarget: 15,
    maxPairs: 8,
    guaranteedMatches: null,
    pricePerPair: 0,
    priceUnit: "pair",
    requiresDeposit: false,
    depositType: null,
    depositValue: 0,
    acceptsMp: true,
    acceptsCash: false,
    acceptsTransfer: false,
  };
}

export function CategoryForm({
  initial,
  onCancel,
  onSubmit,
  pending,
}: {
  initial: CategoryInput;
  onCancel: () => void;
  onSubmit: (input: CategoryInput) => void;
  pending: boolean;
}) {
  const [input, setInput] = useState<CategoryInput>(initial);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<CategoryInput>) {
    setInput((prev) => ({ ...prev, ...p }));
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-4">
      {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
      <div>
        <label className="text-xs font-medium text-[var(--text-tertiary)]">Nombre</label>
        <input
          value={input.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="ej. 8va Caballeros"
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-tertiary)]">Modalidad</label>
        <div className="mt-1 flex gap-2">
          {(["caballeros", "damas", "mixto", null] as const).map((m) => (
            <button
              key={m ?? "libre"}
              type="button"
              onClick={() => patch({ modality: m })}
              className={`rounded-full border px-3 py-1 text-xs ${input.modality === m ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
            >
              {m ?? "Libre"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-tertiary)]">Categoría</label>
        <div className="mt-1 flex gap-2">
          {(["traditional", "suma", "open"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => patch({ categoryKind: k })}
              className={`rounded-full border px-3 py-1 text-xs ${input.categoryKind === k ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
            >
              {k === "traditional" ? "Niveles permitidos" : k === "suma" ? "Suma" : "Libre"}
            </button>
          ))}
        </div>
        {input.categoryKind === "traditional" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEVEL_OPTIONS.map((lvl) => {
              const checked = (input.levels ?? []).includes(lvl);
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() =>
                    patch({
                      levels: checked ? (input.levels ?? []).filter((l) => l !== lvl) : [...(input.levels ?? []), lvl],
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-xs ${checked ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
                >
                  {formatLevel(lvl)}
                </button>
              );
            })}
          </div>
        ) : null}
        {input.categoryKind === "suma" ? (
          <input
            type="number"
            value={input.sumaTarget ?? ""}
            onChange={(e) => patch({ sumaTarget: Number(e.target.value) })}
            placeholder="ej. 15"
            className="mt-2 w-32 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm"
          />
        ) : null}
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
          {input.categoryKind === "traditional" ? "player.category IN niveles elegidos — sin jerarquía." : null}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)]">Cupo (parejas)</label>
          <input
            type="number"
            value={input.maxPairs}
            onChange={(e) => patch({ maxPairs: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)]">Partidos garantizados</label>
          <input
            type="number"
            value={input.guaranteedMatches ?? ""}
            onChange={(e) => patch({ guaranteedMatches: e.target.value ? Number(e.target.value) : null })}
            placeholder="opcional"
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)]">Precio</label>
          <input
            type="number"
            value={input.pricePerPair}
            onChange={(e) => patch({ pricePerPair: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)]">Unidad</label>
          <div className="mt-1 flex gap-2">
            {(["pair", "player"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => patch({ priceUnit: u })}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs ${input.priceUnit === u ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
              >
                {u === "pair" ? "Por pareja" : "Por jugador"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={input.requiresDeposit} onChange={(e) => patch({ requiresDeposit: e.target.checked })} />
          Con seña
        </label>
        {input.requiresDeposit ? (
          <div className="mt-2 flex gap-2">
            {(["percentage", "fixed"] as const).map((dt) => (
              <button
                key={dt}
                type="button"
                onClick={() => patch({ depositType: dt })}
                className={`rounded-full border px-3 py-1 text-xs ${input.depositType === dt ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]" : "border-[var(--border-subtle)]"}`}
              >
                {dt === "percentage" ? "%" : "Monto fijo"}
              </button>
            ))}
            <input
              type="number"
              value={input.depositValue ?? 0}
              onChange={(e) => patch({ depositValue: Number(e.target.value) })}
              className="w-28 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs"
            />
          </div>
        ) : null}
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-tertiary)]">Métodos de pago que acepta esta categoría</label>
        <div className="mt-1 flex gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={input.acceptsMp} onChange={(e) => patch({ acceptsMp: e.target.checked })} /> Mercado Pago
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={input.acceptsCash} onChange={(e) => patch({ acceptsCash: e.target.checked })} /> Efectivo
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={input.acceptsTransfer} onChange={(e) => patch({ acceptsTransfer: e.target.checked })} /> Transferencia
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            if (!input.name.trim()) {
              setError("El nombre es obligatorio.");
              return;
            }
            onSubmit(input);
          }}
          className={`${adminCTAPrimary} disabled:opacity-50`}
        >
          {pending ? "Guardando…" : "Guardar categoría"}
        </button>
        <button type="button" disabled={pending} className={adminButtonSecondary} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
