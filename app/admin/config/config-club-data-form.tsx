"use client";

import { saveClubData } from "../club/actions";

const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

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

export default function ConfigClubDataForm({ initial }: Props) {
  return (
    <form action={saveClubData} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nombre del club</span>
        <input name="name" defaultValue={initial.name} required className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Descripción</span>
        <textarea name="description" defaultValue={initial.description} rows={4} className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dirección completa</span>
        <input name="address" defaultValue={initial.address} className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Teléfono de contacto</span>
        <input name="contact_phone" defaultValue={initial.contact_phone} className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">WhatsApp (número)</span>
        <input name="whatsapp" defaultValue={initial.whatsapp} placeholder="Ej. 549341..." className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Instagram (usuario, sin @)</span>
        <input name="instagram" defaultValue={initial.instagram} placeholder="padelibre" className={inputClass} />
      </label>
      <input type="hidden" name="business_hours" value={initial.business_hours} />
      <button
        type="submit"
        className="rounded-xl bg-[#0585FC] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
      >
        Guardar datos
      </button>
    </form>
  );
}
