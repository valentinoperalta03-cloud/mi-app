"use client";

import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { saveClubData } from "@/app/admin/club/actions";

const inputClass =
  "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]";

type Props = {
  initial: {
    name: string;
    description: string;
    address: string;
    contact_phone: string;
    whatsapp: string;
    instagram: string;
    business_hours: string;
  };
};

/** Subconjunto (nombre + descripción) del mismo saveClubData que usa ConfigClubDataForm.
 * Preserva el resto de columnas via hidden inputs para no pisarlas al guardar. */
export default function ConfigClubIdentityForm({ initial }: Props) {
  return (
    <form action={saveClubData} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Nombre del club</span>
        <input name="name" defaultValue={initial.name} required className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Descripción</span>
        <textarea name="description" defaultValue={initial.description} rows={4} className={inputClass} />
      </label>
      <input type="hidden" name="address" value={initial.address} />
      <input type="hidden" name="contact_phone" value={initial.contact_phone} />
      <input type="hidden" name="whatsapp" value={initial.whatsapp} />
      <input type="hidden" name="instagram" value={initial.instagram} />
      <input type="hidden" name="business_hours" value={initial.business_hours} />
      <button type="submit" className={adminCTAPrimary}>
        Guardar datos
      </button>
    </form>
  );
}
