"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setUserFavorite } from "@/app/(player)/jugador/[userId]/actions";
import { AppleToast } from "@/components/apple-toast";

export function FavoritePlayerButton({
  targetUserId,
  initialFavorited,
}: {
  targetUserId: string;
  initialFavorited: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2600);
  }

  function handleClick() {
    startTransition(async () => {
      const next = !favorited;
      const res = await setUserFavorite(targetUserId, next);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      if (next) {
        setFavorited(true);
        if (res.added) showToast("Añadido a tus favoritos");
        else showToast("Ya estaba en favoritos");
      } else {
        setFavorited(false);
        showToast("Quitado de favoritos");
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => handleClick()}
        aria-pressed={favorited}
        aria-label={favorited ? "Quitar de favoritos" : "Añadir a favoritos"}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-500 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.15)] backdrop-blur-sm transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
      >
        <Star
          size={22}
          strokeWidth={2}
          className={favorited ? "fill-amber-400 text-amber-500" : ""}
          aria-hidden
        />
      </button>
      <AppleToast message={toast} />
    </>
  );
}
