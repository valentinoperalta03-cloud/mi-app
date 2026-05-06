"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { updateClubInfo } from "./actions";
import { createClient } from "@/utils/supabase/client";

const BUCKET = "clubs";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function buildTimeSlots(): string[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  for (let h = 6; h < 24; h++) {
    out.push(`${pad(h)}:00`);
    out.push(`${pad(h)}:30`);
  }
  for (let h = 0; h <= 2; h++) {
    out.push(`${pad(h)}:00`);
    if (h < 2) out.push(`${pad(h)}:30`);
  }
  return out;
}

const TIME_SLOTS = buildTimeSlots();

function snapToNearestSlot(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "08:00";
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const total = h * 60 + min;
  let best = TIME_SLOTS[0]!;
  let bestDist = Infinity;
  for (const s of TIME_SLOTS) {
    const [sh, sm] = s.split(":").map(Number);
    const st = sh * 60 + sm;
    const d = Math.abs(st - total);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

function parseBusinessHours(raw: string): { open: string; close: string } {
  const defaultOpen = "08:00";
  const defaultClose = "22:00";
  const match = raw.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!match) return { open: defaultOpen, close: defaultClose };
  return {
    open: snapToNearestSlot(match[1]),
    close: snapToNearestSlot(match[2]),
  };
}

function extFromFile(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

type Props = {
  clubId: string;
  initial: {
    name: string;
    location: string;
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

type ImageSlot = {
  label: string;
  pathBase: string;
  state: string;
  setState: (v: string) => void;
  previewClass: string;
};

export default function ClubForm({ clubId, initial }: Props) {
  const initialHours = parseBusinessHours(initial.business_hours);
  const [hoursOpen, setHoursOpen] = useState(initialHours.open);
  const [hoursClose, setHoursClose] = useState(initialHours.close);

  const [logoUrl, setLogoUrl] = useState(initial.logo_url);
  const [coverUrl, setCoverUrl] = useState(initial.cover_image_url);
  const [g1, setG1] = useState(initial.gallery_image_1);
  const [g2, setG2] = useState(initial.gallery_image_2);
  const [g3, setG3] = useState(initial.gallery_image_3);
  const [g4, setG4] = useState(initial.gallery_image_4);

  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const g1Ref = useRef<HTMLInputElement>(null);
  const g2Ref = useRef<HTMLInputElement>(null);
  const g3Ref = useRef<HTMLInputElement>(null);
  const g4Ref = useRef<HTMLInputElement>(null);

  async function handleImageUpload(
    file: File,
    pathBase: string,
    setUrl: (u: string) => void,
    revertTo: string
  ) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Seleccioná una imagen válida (JPEG, PNG o WebP).");
      setUrl(revertTo);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Formato no permitido. Usá JPEG, PNG o WebP.");
      setUrl(revertTo);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("La imagen supera 5MB.");
      setUrl(revertTo);
      return;
    }
    setUploading(pathBase);
    setUploadError(null);
    const supabase = createClient();
    const ext = extFromFile(file);
    const path = `${clubId}/${pathBase}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });
    if (error) {
      setUploadError(`No se pudo subir: ${error.message}`);
      setUrl(revertTo);
      setUploading(null);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const nextUrl = `${publicUrl}?v=${Date.now()}`;
    setUrl(nextUrl);
    setUploading(null);
  }

  const slots: ImageSlot[] = [
    {
      label: "Logo del club",
      pathBase: "logo",
      state: logoUrl,
      setState: setLogoUrl,
      previewClass: "h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700",
    },
    {
      label: "Foto principal / portada",
      pathBase: "cover",
      state: coverUrl,
      setState: setCoverUrl,
      previewClass: "h-32 w-full max-w-md rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700",
    },
    {
      label: "Foto adicional 1",
      pathBase: "gallery-1",
      state: g1,
      setState: setG1,
      previewClass: "h-24 w-full max-w-xs rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700",
    },
    {
      label: "Foto adicional 2",
      pathBase: "gallery-2",
      state: g2,
      setState: setG2,
      previewClass: "h-24 w-full max-w-xs rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700",
    },
    {
      label: "Foto adicional 3",
      pathBase: "gallery-3",
      state: g3,
      setState: setG3,
      previewClass: "h-24 w-full max-w-xs rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700",
    },
    {
      label: "Foto adicional 4",
      pathBase: "gallery-4",
      state: g4,
      setState: setG4,
      previewClass: "h-24 w-full max-w-xs rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700",
    },
  ];

  const fileRefs = [logoRef, coverRef, g1Ref, g2Ref, g3Ref, g4Ref];

  return (
    <form
      action={updateClubInfo}
      className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={(e) => {
        if (uploading) e.preventDefault();
      }}
    >
      <input type="hidden" name="business_hours" value={`${hoursOpen} - ${hoursClose}`} />

      <input type="hidden" name="logo_url" value={logoUrl} />
      <input type="hidden" name="cover_image_url" value={coverUrl} />
      <input type="hidden" name="gallery_image_1" value={g1} />
      <input type="hidden" name="gallery_image_2" value={g2} />
      <input type="hidden" name="gallery_image_3" value={g3} />
      <input type="hidden" name="gallery_image_4" value={g4} />

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nombre del club</span>
        <input name="name" defaultValue={initial.name} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ciudad / ubicación</span>
        <input
          name="location"
          defaultValue={initial.location}
          placeholder="Ej: Rosario, Santa Fe"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
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

      <div className="space-y-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Horario de atención general</span>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            Apertura
            <select
              value={hoursOpen}
              onChange={(e) => setHoursOpen(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {TIME_SLOTS.map((t) => (
                <option key={`o-${t}`} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <span className="pt-5 text-slate-500">—</span>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            Cierre
            <select
              value={hoursClose}
              onChange={(e) => setHoursClose(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {TIME_SLOTS.map((t) => (
                <option key={`c-${t}`} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">Se guarda como: {hoursOpen} - {hoursClose}</p>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imágenes (subida directa)</p>
      {uploadError ? <p className="text-sm text-rose-600">{uploadError}</p> : null}

      {slots.map((slot, idx) => (
        <div key={slot.pathBase} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{slot.label}</p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <div className="relative">
              {slot.state ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview URL pública o existente
                <img src={slot.state} alt="" className={slot.previewClass} />
              ) : (
                <div className={`flex items-center justify-center bg-slate-200/80 text-xs text-slate-500 dark:bg-slate-800 ${slot.previewClass}`}>
                  Sin imagen
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRefs[idx]?.current?.click()}
                disabled={uploading !== null}
                className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-slate-900 text-white shadow disabled:opacity-50 dark:border-slate-600"
                aria-label={`Subir ${slot.label}`}
              >
                {uploading === slot.pathBase ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera size={16} />}
              </button>
              <input
                ref={fileRefs[idx]}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (ev) => {
                  const file = ev.target.files?.[0] ?? null;
                  ev.target.value = "";
                  if (!file) return;
                  const prev = slot.state;
                  const objectUrl = URL.createObjectURL(file);
                  slot.setState(objectUrl);
                  await handleImageUpload(file, slot.pathBase, slot.setState, prev);
                  URL.revokeObjectURL(objectUrl);
                }}
              />
            </div>
            <p className="max-w-sm text-xs text-slate-500">JPEG, PNG o WebP. Máx. 5MB. Se guarda en Storage y la URL en el club.</p>
          </div>
        </div>
      ))}

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Política de cancelación (opcional)</span>
        <textarea name="cancellation_policy" defaultValue={initial.cancellation_policy} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <button
        type="submit"
        disabled={uploading !== null}
        className="rounded-xl bg-[#0585FC] px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        Guardar cambios
      </button>
    </form>
  );
}
