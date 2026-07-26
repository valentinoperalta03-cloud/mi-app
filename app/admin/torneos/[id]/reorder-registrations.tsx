"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminButtonSecondary, adminCTAPrimary } from "@/components/admin/admin-premium";
import { reorderTournamentRegistrationsAction } from "./actions";

type Item = { id: string; label: string };

export function ReorderRegistrations({ tournamentId, items }: { tournamentId: string; items: Item[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<Item[]>(items);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (items.length < 2) return null;

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function handleSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await reorderTournamentRegistrationsAction(
        tournamentId,
        order.map((o) => o.id)
      );
      setMsg(res.message);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setOrder(items);
          setMsg(null);
          setEditing(true);
        }}
        className={`mt-2 ${adminButtonSecondary}`}
      >
        Reordenar inscriptos
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-[var(--text-tertiary)]">
        El orden define los cruces del fixture: 1 vs 2, 3 vs 4, etc.
      </p>
      {msg ? <p className="text-xs text-[var(--text-secondary)]">{msg}</p> : null}
      <ul className="space-y-1.5">
        {order.map((item, i) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate text-[var(--text-primary)]">
              {i + 1}. {item.label}
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Subir"
                className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label="Bajar"
                className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={pending} className={`${adminCTAPrimary} disabled:opacity-50`}>
          {pending ? "Guardando…" : "Guardar orden"}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className={adminButtonSecondary}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
