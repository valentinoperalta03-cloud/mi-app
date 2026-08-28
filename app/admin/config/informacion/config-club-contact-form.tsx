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

/** Subconjunto (dirección + contacto) del mismo saveClubData que usa ConfigClubDataForm.
 * Preserva el resto de columnas via hidden inputs para no pisarlas al guardar. */
export default function ConfigClubContactForm({ initial }: Props) {
  return (
    <form action={saveClubData} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Dirección completa</span>
        <input name="address" defaultValue={initial.address} className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Teléfono de contacto</span>
        <input name="contact_phone" defaultValue={initial.contact_phone} className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">WhatsApp (número)</span>
        <input name="whatsapp" defaultValue={initial.whatsapp} placeholder="Ej. 549341..." className={inputClass} />
      </label>
      <input type="hidden" name="name" value={initial.name} />
      <input type="hidden" name="description" value={initial.description} />
      <input type="hidden" name="instagram" value={initial.instagram} />
      <input type="hidden" name="business_hours" value={initial.business_hours} />
      <button type="submit" className={adminCTAPrimary}>
        Guardar contacto
      </button>
    </form>
  );
}
