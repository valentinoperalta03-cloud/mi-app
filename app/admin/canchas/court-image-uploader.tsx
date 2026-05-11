"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const BUCKET = "courts";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extFromFile(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

export default function CourtImageUploader({
  courtId,
  initialUrl = "",
  inputName = "image_url",
  label = "Imagen",
}: {
  courtId: string;
  initialUrl?: string;
  inputName?: string;
  label?: string;
}) {
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Seleccioná una imagen válida.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Formato no permitido. Usá JPEG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen supera 5MB.");
      return;
    }
    setUploading(true);
    setError(null);

    const previous = imageUrl;
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);

    const supabase = createClient();
    const ext = extFromFile(file);
    const path = `${courtId}/main.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });
    if (uploadErr) {
      setImageUrl(previous);
      setError(`No se pudo subir: ${uploadErr.message}`);
      URL.revokeObjectURL(objectUrl);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setImageUrl(`${publicUrl}?v=${Date.now()}`);
    URL.revokeObjectURL(objectUrl);
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <input type="hidden" name={inputName} value={imageUrl} />
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="relative">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview URL pública
            <img src={imageUrl} alt={label} className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-200 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Sin imagen
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-slate-900 text-white shadow disabled:opacity-50 dark:border-slate-600"
            aria-label="Subir imagen"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera size={15} />}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!file) return;
              await handleFile(file);
            }}
          />
        </div>
        <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">JPEG/PNG/WebP, máx. 5MB. Se guarda en Storage `courts`.</p>
      </div>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
