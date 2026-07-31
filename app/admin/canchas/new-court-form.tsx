"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminButtonSecondary,
  adminCTAPrimary,
  adminCard,
  adminKicker,
} from "@/components/admin/admin-premium";
import CourtImageUploader from "./court-image-uploader";
import { createCourt, duplicateCourtAction, type CreateCourtState } from "./actions";

const initialState: CreateCourtState = { ok: false, message: "" };
const COUNT_OPTIONS = [0, 1, 2, 3, 4] as const;

export default function NewCourtForm({
  clubs,
  ownerUserId,
}: {
  clubs: Array<{ id: string; name: string | null }>;
  ownerUserId: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createCourt, initialState);
  const [selectedCount, setSelectedCount] = useState<number | "5+">(0);
  const [customCount, setCustomCount] = useState("5");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [dismissedCourtId, setDismissedCourtId] = useState<string | null>(null);
  const [isDuplicating, startDuplicating] = useTransition();

  function goToList() {
    if (state.court) setDismissedCourtId(state.court.id);
    router.push("/admin/canchas");
    router.refresh();
  }

  function handleConfirmDuplicates() {
    if (!state.ok || !state.court) return;
    const count = selectedCount === "5+" ? Number.parseInt(customCount, 10) || 0 : selectedCount;
    if (count <= 0) {
      goToList();
      return;
    }
    setDuplicateError(null);
    startDuplicating(async () => {
      const result = await duplicateCourtAction(state.court!.id, count);
      if (!result.ok) {
        setDuplicateError(result.error ?? "No se pudieron crear las canchas.");
        return;
      }
      goToList();
    });
  }

  if (state.ok && state.court && state.court.id !== dismissedCourtId) {
    return (
      <div className={`${adminCard} space-y-4`}>
        <p className="text-lg font-bold text-[var(--text-primary)]">✅ ¡Cancha creada!</p>
        <p className="text-sm font-semibold text-[var(--text-secondary)]">
          ¿Cuántas canchas más iguales a esta tenés?
        </p>
        <div className="flex flex-wrap gap-2">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSelectedCount(n)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                selectedCount === n
                  ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0461C4]"
                  : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedCount("5+")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              selectedCount === "5+"
                ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0461C4]"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            5+
          </button>
        </div>
        {selectedCount === "5+" ? (
          <input
            type="number"
            min={5}
            value={customCount}
            onChange={(e) => setCustomCount(e.target.value)}
            className="w-24 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)]"
          />
        ) : null}
        <p className="text-xs font-medium text-[var(--text-tertiary)]">
          Si tenés canchas de otro tipo (indoor/outdoor), las podés agregar después.
        </p>
        {duplicateError ? <p className="text-xs font-semibold text-rose-600">{duplicateError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleConfirmDuplicates}
            disabled={isDuplicating}
            className={adminCTAPrimary}
          >
            {isDuplicating ? "Creando..." : "Crear canchas"}
          </button>
          <button type="button" onClick={goToList} className={adminButtonSecondary}>
            No, solo esta
          </button>
        </div>
      </div>
    );
  }

  return (
    <details className={`${adminCard} group`}>
      <summary className="cursor-pointer list-none text-sm font-semibold text-[#0461C4] marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/5 px-4 py-2 group-open:border-[#0085FC]/30">
          Nueva cancha +
        </span>
      </summary>
      <form action={formAction} className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
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
        <CourtImageUploader courtId={`new-${ownerUserId}`} label="Imagen de cancha" />
        {!state.ok && state.message ? (
          <p className="text-xs font-semibold text-rose-600">{state.message}</p>
        ) : null}
        <button type="submit" disabled={isPending} className={`w-full ${adminCTAPrimary}`}>
          {isPending ? "Creando..." : "Crear cancha"}
        </button>
      </form>
    </details>
  );
}
