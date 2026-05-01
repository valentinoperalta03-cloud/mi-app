"use client";

import { useState } from "react";
import { updateClubInfo } from "./actions";

type Props = {
  initial: {
    name: string;
    description: string;
    address: string;
    contact_phone: string;
    whatsapp: string;
    instagram: string;
    business_hours: string;
    logo_url: string;
    cover_image_url: string;
    gallery_image_1: string;
    gallery_image_2: string;
    gallery_image_3: string;
    gallery_image_4: string;
    cancellation_policy: string;
  };
};

export default function ClubForm({ initial }: Props) {
  const [logo, setLogo] = useState(initial.logo_url);
  const [cover, setCover] = useState(initial.cover_image_url);
  const [g1, setG1] = useState(initial.gallery_image_1);
  const [g2, setG2] = useState(initial.gallery_image_2);
  const [g3, setG3] = useState(initial.gallery_image_3);
  const [g4, setG4] = useState(initial.gallery_image_4);

  return (
    <form action={updateClubInfo} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nombre del club</span>
        <input name="name" defaultValue={initial.name} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Descripción</span>
        <textarea name="description" defaultValue={initial.description} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dirección completa</span>
        <input name="address" defaultValue={initial.address} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Teléfono de contacto</span>
        <input name="contact_phone" defaultValue={initial.contact_phone} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">WhatsApp (número)</span>
        <input name="whatsapp" defaultValue={initial.whatsapp} placeholder="Ej. 549341..." className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Instagram (usuario, sin @)</span>
        <input name="instagram" defaultValue={initial.instagram} placeholder="padelibre" className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Horario de atención general</span>
        <input name="business_hours" defaultValue={initial.business_hours} placeholder="Lun-Dom 8:00-23:00" className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Logo URL</span>
        <input name="logo_url" defaultValue={initial.logo_url} onChange={(e) => setLogo(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      {logo ? <img src={logo} alt="Preview logo" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" /> : null}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Foto principal / portada URL</span>
        <input name="cover_image_url" defaultValue={initial.cover_image_url} onChange={(e) => setCover(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      {cover ? <img src={cover} alt="Preview portada" className="h-32 w-full rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" /> : null}
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fotos adicionales (hasta 4)</p>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Foto adicional 1</span>
        <input name="gallery_image_1" defaultValue={initial.gallery_image_1} onChange={(e) => setG1(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      {g1 ? <img src={g1} alt="Preview 1" className="h-24 w-full max-w-xs rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" /> : null}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Foto adicional 2</span>
        <input name="gallery_image_2" defaultValue={initial.gallery_image_2} onChange={(e) => setG2(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      {g2 ? <img src={g2} alt="Preview 2" className="h-24 w-full max-w-xs rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" /> : null}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Foto adicional 3</span>
        <input name="gallery_image_3" defaultValue={initial.gallery_image_3} onChange={(e) => setG3(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      {g3 ? <img src={g3} alt="Preview 3" className="h-24 w-full max-w-xs rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" /> : null}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Foto adicional 4</span>
        <input name="gallery_image_4" defaultValue={initial.gallery_image_4} onChange={(e) => setG4(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      {g4 ? <img src={g4} alt="Preview 4" className="h-24 w-full max-w-xs rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" /> : null}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Política de cancelación (opcional)</span>
        <textarea name="cancellation_policy" defaultValue={initial.cancellation_policy} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <button type="submit" className="rounded-xl bg-[#0585FC] px-4 py-2 font-semibold text-white">
        Guardar cambios
      </button>
    </form>
  );
}
