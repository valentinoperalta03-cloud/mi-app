"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { saveClubPhotos } from "../club/actions";
import { createClient } from "@/utils/supabase/client";

const BUCKET = "clubs";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extFromFile(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

type ImageSlot = {
  label: string;
  pathBase: string;
  state: string;
  setState: (v: string) => void;
  previewClass: string;
};

type Props = {
  clubId: string;
  initial: {
    logo_url: string;
    cover_image_url: string;
    gallery_image_1: string;
    gallery_image_2: string;
    gallery_image_3: string;
    gallery_image_4: string;
  };
};

export default function ConfigClubPhotosForm({ clubId, initial }: Props) {
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
    setUrl(`${publicUrl}?v=${Date.now()}`);
    setUploading(null);
  }

  const slots: ImageSlot[] = [
    {
      label: "Logo del club",
      pathBase: "logo",
      state: logoUrl,
      setState: setLogoUrl,
      previewClass: "h-20 w-20 rounded-2xl object-cover ring-1 ring-[var(--border-subtle)]",
    },
    {
      label: "Foto de portada",
      pathBase: "cover",
      state: coverUrl,
      setState: setCoverUrl,
      previewClass: "h-36 w-full max-w-lg rounded-2xl object-cover ring-1 ring-[var(--border-subtle)]",
    },
    {
      label: "Galería 1",
      pathBase: "gallery-1",
      state: g1,
      setState: setG1,
      previewClass: "h-28 w-full max-w-xs rounded-xl object-cover ring-1 ring-[var(--border-subtle)]",
    },
    {
      label: "Galería 2",
      pathBase: "gallery-2",
      state: g2,
      setState: setG2,
      previewClass: "h-28 w-full max-w-xs rounded-xl object-cover ring-1 ring-[var(--border-subtle)]",
    },
    {
      label: "Galería 3",
      pathBase: "gallery-3",
      state: g3,
      setState: setG3,
      previewClass: "h-28 w-full max-w-xs rounded-xl object-cover ring-1 ring-[var(--border-subtle)]",
    },
    {
      label: "Galería 4",
      pathBase: "gallery-4",
      state: g4,
      setState: setG4,
      previewClass: "h-28 w-full max-w-xs rounded-xl object-cover ring-1 ring-[var(--border-subtle)]",
    },
  ];

  const fileRefs = [logoRef, coverRef, g1Ref, g2Ref, g3Ref, g4Ref];

  return (
    <form
      action={saveClubPhotos}
      className="space-y-4"
      onSubmit={(e) => {
        if (uploading) e.preventDefault();
      }}
    >
      <input type="hidden" name="logo_url" value={logoUrl} />
      <input type="hidden" name="cover_image_url" value={coverUrl} />
      <input type="hidden" name="gallery_image_1" value={g1} />
      <input type="hidden" name="gallery_image_2" value={g2} />
      <input type="hidden" name="gallery_image_3" value={g3} />
      <input type="hidden" name="gallery_image_4" value={g4} />

      {uploadError ? <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{uploadError}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {slots.map((slot, idx) => (
          <div
            key={slot.pathBase}
            className="rounded-2xl border border-[var(--border-subtle)] bg-transparent p-4"
          >
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{slot.label}</p>
            <div className="relative mt-3 inline-block">
              {slot.state ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slot.state} alt="" className={slot.previewClass} />
              ) : (
                <div
                  className={`flex items-center justify-center bg-[var(--bg-subtle)] text-xs text-[var(--text-tertiary)] ${slot.previewClass}`}
                >
                  Sin imagen
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRefs[idx]?.current?.click()}
                disabled={uploading !== null}
                className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--bg-card)] bg-[#0A0A0A] text-white shadow disabled:opacity-50"
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
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">JPEG, PNG o WebP · máx. 5MB</p>
          </div>
        ))}
      </div>

      <button type="submit" disabled={uploading !== null} className={`${adminCTAPrimary} disabled:opacity-60`}>
        Guardar fotos
      </button>
    </form>
  );
}
