"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminCTAPrimary, adminCard, adminKicker } from "@/components/admin/admin-premium";
import CourtImageUploader from "./court-image-uploader";
import { createCourt, type CreateCourtState } from "./actions";

const initialState: CreateCourtState = { ok: false, message: "" };
const QUANTITY_OPTIONS = [1, 2, 3, 4] as const;
const MIN_CUSTOM_QUANTITY = 5;
const MAX_CUSTOM_QUANTITY = 15;

function clampCustomQuantity(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return MIN_CUSTOM_QUANTITY;
  return Math.min(MAX_CUSTOM_QUANTITY, Math.max(MIN_CUSTOM_QUANTITY, n));
}

export default function NewCourtForm({
  clubs,
  ownerUserId,
}: {
  clubs: Array<{ id: string; name: string | null }>;
  ownerUserId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(createCourt, initialState);
  const [quantitySelection, setQuantitySelection] = useState<number | "5+">(1);
  const [customQuantity, setCustomQuantity] = useState("5");
  const [imageUploaderKey, setImageUploaderKey] = useState(0);

  const finalQuantity =
    quantitySelection === "5+" ? clampCustomQuantity(customQuantity) : quantitySelection;

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setQuantitySelection(1);
      setCustomQuantity("5");
      setImageUploaderKey((k) => k + 1);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar a nuevos resultados de la action
  }, [state]);

  return (
    <details className={`${adminCard} group`}>
      <summary className="cursor-pointer list-none text-sm font-semibold text-[#0461C4] marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/5 px-4 py-2 group-open:border-[#0085FC]/30">
          Nueva cancha +
        </span>
      </summary>
      <form ref={formRef} action={formAction} className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
        <label className="block space-y-1.5">
          <span className={adminKicker}>Club</span>
          <select
            name="club_id"
            required
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] outline-none focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20"
            defaultValue={clubs[0]?.id ?? ""}
          >
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? "Club"}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className={adminKicker}>Nombre</span>
          <input
            name="name"
            type="text"
            required
            placeholder="Ej. Cancha 1"
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] outline-none focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20"
          />
        </label>
        <label className="block space-y-1.5">
          <span className={adminKicker}>Precio del turno (90 min)</span>
          <input
            name="price"
            type="number"
            min={0}
            required
            placeholder="0"
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] outline-none focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20"
          />
        </label>
        <label className="block space-y-1.5">
          <span className={adminKicker}>Superficie</span>
          <select
            name="surface"
            required
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] outline-none focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20"
            defaultValue="cemento"
          >
            <option value="cemento">Cemento</option>
            <option value="cristal">Cristal</option>
            <option value="cesped sintetico">Césped sintético</option>
            <option value="moqueta">Moqueta</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)]">
          <input type="checkbox" name="indoor" className="h-4 w-4 rounded border-[var(--border-subtle)]" />
          Techada
        </label>
        <CourtImageUploader key={imageUploaderKey} courtId={`new-${ownerUserId}`} label="Imagen de cancha" />

        <div className="space-y-1.5">
          <span className={adminKicker}>Cantidad de canchas</span>
          <div className="flex flex-wrap gap-2">
            {QUANTITY_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQuantitySelection(n)}
                className={`rounded-[8px] border px-4 py-2 text-sm font-semibold transition ${
                  quantitySelection === n
                    ? "border-[#0085FC] bg-[#0085FC] text-white"
                    : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)]"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setQuantitySelection("5+")}
              className={`rounded-[8px] border px-4 py-2 text-sm font-semibold transition ${
                quantitySelection === "5+"
                  ? "border-[#0085FC] bg-[#0085FC] text-white"
                  : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)]"
              }`}
            >
              5+
            </button>
          </div>
          {quantitySelection === "5+" ? (
            <input
              type="number"
              min={MIN_CUSTOM_QUANTITY}
              max={MAX_CUSTOM_QUANTITY}
              value={customQuantity}
              onChange={(e) => setCustomQuantity(e.target.value)}
              onBlur={(e) => setCustomQuantity(String(clampCustomQuantity(e.target.value)))}
              className="w-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)]"
            />
          ) : null}
        </div>
        <input type="hidden" name="quantity" value={finalQuantity} />

        {!state.ok && state.message ? (
          <p className="text-xs font-semibold text-rose-600">{state.message}</p>
        ) : null}
        {state.ok && state.message ? (
          <p className="text-xs font-semibold text-emerald-600">✅ {state.message}</p>
        ) : null}
        <button type="submit" disabled={isPending} className={`w-full ${adminCTAPrimary}`}>
          {isPending ? "Creando..." : "Crear cancha"}
        </button>
      </form>
    </details>
  );
}
