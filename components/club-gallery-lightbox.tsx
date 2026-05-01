"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

export default function ClubGalleryLightbox({ urls }: { urls: string[] }) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenUrl(null);
    },
    []
  );

  useEffect(() => {
    if (!openUrl) return;
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openUrl, onKey]);

  if (urls.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenUrl(url)}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-slate-200/80 transition hover:ring-[#0585FC]/40 focus:outline-none focus:ring-2 focus:ring-[#0585FC]/50 dark:ring-slate-700"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {openUrl ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
          onClick={() => setOpenUrl(null)}
        >
          <button
            type="button"
            onClick={() => setOpenUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={openUrl}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
