"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminButtonSecondary, adminCTAPrimary } from "@/components/admin/admin-premium";
import {
  PENA_CANCELLATION_HOURS_OPTIONS,
  PENA_DURATION_OPTIONS,
  PENA_LEVEL_OPTIONS,
  PENA_MAX_PLAYERS_OPTIONS,
  PENA_WHAT_INCLUDES_OPTIONS,
} from "@/lib/pena-constants";
import { createPenaAction, publishPenaAction, updatePenaAction } from "./actions";

export type PenaFormData = {
  id: string;
  name: string;
  description: string | null;
  what_includes: string[] | null;
  date: string;
  start_time: string;
  duration_minutes: number;
  level: string;
  game_format: string | null;
  max_players: number;
  price_per_player: number;
  accepts_mp: boolean;
  accepts_cash: boolean;
  accepts_transfer: boolean;
  transfer_alias: string | null;
  cancellation_hours: number;
};

type Props = {
  clubId: string;
  mode: "create" | "edit";
  pena?: PenaFormData;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]";

export default function PenaForm({ clubId, mode, pena }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [acceptsTransfer, setAcceptsTransfer] = useState(Boolean(pena?.accepts_transfer));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value === "publish" ? "publish" : "draft";
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result: { ok: boolean; penaId?: string; error?: string } =
        mode === "edit" && pena
          ? await updatePenaAction(pena.id, formData)
          : await createPenaAction(formData);

      if (!result.ok) {
        setError(result.error ?? "No se pudo guardar la peña.");
        return;
      }

      const penaId = mode === "edit" && pena ? pena.id : result.penaId!;

      if (intent === "publish") {
        const pub = await publishPenaAction(penaId);
        if (!pub.ok) {
          setError(`Se guardó, pero no se pudo publicar: ${pub.error}`);
          router.push(`/admin/penas/${penaId}`);
          router.refresh();
          return;
        }
      }

      router.push(`/admin/penas/${penaId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
      <input type="hidden" name="club_id" value={clubId} />
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Nombre</span>
        <input name="name" required defaultValue={pena?.name} className={inputClass} />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Descripción (opcional)</span>
        <textarea name="description" rows={2} defaultValue={pena?.description ?? ""} className={inputClass} />
      </label>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--text-secondary)]">Qué incluye</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PENA_WHAT_INCLUDES_OPTIONS.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2"
            >
              <input
                type="checkbox"
                name="what_includes"
                value={opt}
                defaultChecked={pena?.what_includes?.includes(opt)}
              />
              <span className="text-[var(--text-primary)]">{opt}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Fecha</span>
          <input type="date" name="date" required defaultValue={pena?.date} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Hora de inicio</span>
          <input
            type="time"
            name="start_time"
            required
            defaultValue={pena?.start_time?.slice(0, 5)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Duración</span>
          <select name="duration_minutes" defaultValue={pena?.duration_minutes ?? 90} className={inputClass}>
            {PENA_DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Nivel</span>
          <select name="level" required defaultValue={pena?.level ?? ""} className={inputClass}>
            <option value="" disabled>
              Elegí un nivel
            </option>
            {PENA_LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Formato de juego (opcional)</span>
        <input
          name="game_format"
          placeholder="Set a 6, Tie Break, etc."
          defaultValue={pena?.game_format ?? ""}
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Máximo de jugadores</span>
          <select name="max_players" defaultValue={pena?.max_players ?? 16} className={inputClass}>
            {PENA_MAX_PLAYERS_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Precio por jugador (ARS)</span>
          <input
            type="number"
            name="price_per_player"
            min={0}
            step="100"
            defaultValue={pena?.price_per_player ?? 0}
            className={inputClass}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--text-secondary)]">Métodos de pago</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2">
            <input type="checkbox" name="accepts_mp" value="true" defaultChecked={pena?.accepts_mp ?? true} />
            <span className="text-[var(--text-primary)]">Mercado Pago</span>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2">
            <input type="checkbox" name="accepts_cash" value="true" defaultChecked={pena?.accepts_cash ?? true} />
            <span className="text-[var(--text-primary)]">Efectivo</span>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2">
            <input
              type="checkbox"
              name="accepts_transfer"
              value="true"
              checked={acceptsTransfer}
              onChange={(e) => setAcceptsTransfer(e.target.checked)}
            />
            <span className="text-[var(--text-primary)]">Transferencia</span>
          </label>
        </div>
      </fieldset>

      {acceptsTransfer ? (
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Alias / CBU para transferencia</span>
          <input name="transfer_alias" required={acceptsTransfer} defaultValue={pena?.transfer_alias ?? ""} className={inputClass} />
        </label>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Política de cancelación</span>
        <select name="cancellation_hours" defaultValue={pena?.cancellation_hours ?? 24} className={inputClass}>
          {PENA_CANCELLATION_HOURS_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {h} hs antes
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className={`w-full text-center sm:w-auto ${adminButtonSecondary} disabled:opacity-50`}
        >
          {pending ? "Guardando…" : "Guardar como borrador"}
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className={`w-full text-center sm:w-auto ${adminCTAPrimary} disabled:opacity-50`}
        >
          {pending ? "Guardando…" : "Publicar directamente"}
        </button>
      </div>
    </form>
  );
}
