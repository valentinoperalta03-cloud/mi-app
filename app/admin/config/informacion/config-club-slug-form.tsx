"use client";

import { useMemo, useState, useTransition } from "react";
import { adminButtonSecondary, adminCTAPrimary } from "@/components/admin/admin-premium";
import { updateClubSlugAction } from "./actions";

const inputClass =
  "w-full rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]";

type Props = {
  clubId: string;
  initialSlug: string;
};

function sanitizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

export default function ConfigClubSlugForm({ clubId, initialSlug }: Props) {
  const [slug, setSlug] = useState(initialSlug);
  const [savedSlug, setSavedSlug] = useState(initialSlug);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const publicUrl = useMemo(() => `https://padelibre.online/${savedSlug || "tu-club"}`, [savedSlug]);

  function handleSave() {
    setError(null);
    setSaved(false);
    if (!slug) {
      setError("Ingresá un link para tu club.");
      return;
    }
    startTransition(async () => {
      const res = await updateClubSlugAction(clubId, slug);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSavedSlug(slug);
      setSaved(true);
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar el link.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-tertiary)]">
        padelibre.online/<span className="font-semibold text-[var(--text-secondary)]">{savedSlug || "tu-club"}</span>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={slug}
          onChange={(e) => setSlug(sanitizeSlugInput(e.target.value))}
          placeholder="mi-club-de-padel"
          className={inputClass}
        />
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={pending} className={`${adminCTAPrimary} whitespace-nowrap disabled:opacity-60`}>
            Guardar link
          </button>
          <button type="button" onClick={() => void handleCopy()} className={`${adminButtonSecondary} whitespace-nowrap`}>
            {copied ? "¡Copiado!" : "Copiar link"}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {saved && !error ? <p className="text-sm font-medium text-emerald-600">Link guardado correctamente.</p> : null}
    </div>
  );
}
