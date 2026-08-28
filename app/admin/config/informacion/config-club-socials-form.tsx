"use client";

import { useState, useTransition } from "react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { updateClubSocialsAction } from "./actions";

const inputClass =
  "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]";

type Props = {
  clubId: string;
  initial: {
    instagram: string;
    facebook: string;
    tiktok: string;
  };
};

export default function ConfigClubSocialsForm({ clubId, initial }: Props) {
  const [instagram, setInstagram] = useState(initial.instagram);
  const [facebook, setFacebook] = useState(initial.facebook);
  const [tiktok, setTiktok] = useState(initial.tiktok);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateClubSocialsAction(clubId, { instagram, facebook, tiktok });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Instagram</span>
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@usuario"
          className={inputClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Facebook</span>
        <input
          value={facebook}
          onChange={(e) => setFacebook(e.target.value)}
          placeholder="@pagina"
          className={inputClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">TikTok</span>
        <input
          value={tiktok}
          onChange={(e) => setTiktok(e.target.value)}
          placeholder="@usuario"
          className={inputClass}
        />
      </label>
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {saved && !error ? <p className="text-sm font-medium text-emerald-600">Redes guardadas correctamente.</p> : null}
      <button type="button" onClick={handleSave} disabled={pending} className={`${adminCTAPrimary} disabled:opacity-60`}>
        Guardar redes
      </button>
    </div>
  );
}
