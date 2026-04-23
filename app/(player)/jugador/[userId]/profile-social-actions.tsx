"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MessageSquare, Share2, UserCheck, UserPlus } from "lucide-react";
import { AppleToast } from "@/components/apple-toast";
import { followUser, unfollowUser } from "./actions";

type ProfileSocialActionsProps = {
  userId: string;
  initialFavorited: boolean;
};

export default function ProfileSocialActions({ userId, initialFavorited }: ProfileSocialActionsProps) {
  const [following, setFollowing] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2300);
  }

  function handleToggleFollow() {
    startTransition(async () => {
      const next = !following;
      const res = next ? await followUser(userId) : await unfollowUser(userId);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setFollowing(next);
      showToast(next ? "Ahora seguís a este jugador." : "Dejaste de seguir a este jugador.");
    });
  }

  async function handleShareProfile() {
    const shareUrl = `https://padelibre.app/jugador/${userId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link del perfil copiado.");
    } catch {
      showToast("No se pudo copiar el link.");
    }
  }

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          disabled={pending}
          onClick={handleToggleFollow}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60 ${
            following
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "bg-[color:var(--color-brand-mid)] text-white"
          }`}
        >
          {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
          {following ? "Siguiendo" : "Seguir"}
        </button>
        <Link
          href={`/comunidad/mensajes/${userId}`}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-brand-mid)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-brand-light)] active:scale-[0.98]"
        >
          <MessageSquare size={16} />
          Enviar mensaje
        </Link>
        <button
          type="button"
          onClick={() => void handleShareProfile()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <Share2 size={16} />
          Compartir perfil
        </button>
      </div>
      <AppleToast message={toast} />
    </>
  );
}
