"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, UserCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { setUserFavorite } from "@/app/(player)/jugador/[userId]/actions";
import { AppleToast } from "@/components/apple-toast";

export default function ProfileSocialActions({
  targetUserId,
  initialFollowing,
  followsBack,
  initialIsMutual,
  isMe,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  followsBack: boolean;
  initialIsMutual: boolean;
  isMe: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [mutual, setMutual] = useState(initialFollowing && followsBack ? true : initialIsMutual);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isMe) return null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function handleFollow() {
    startTransition(async () => {
      const next = !following;
      const res = await setUserFavorite(targetUserId, next);
      if (res.ok) {
        setFollowing(next);
        if (next && followsBack) setMutual(true);
        if (!next) setMutual(false);
        showToast(next ? "¡Ahora seguís a este jugador!" : "Dejaste de seguir");
        router.refresh();
      } else {
        showToast(res.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleFollow}
          disabled={pending}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all disabled:opacity-60 ${
            following
              ? "border border-slate-200 dark:border-slate-700 text-[var(--text-secondary)] bg-[var(--bg-card)]"
              : "text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
          }`}
          style={!following ? { background: "linear-gradient(135deg, #0085FC 0%, #0461C4 100%)" } : {}}
        >
          {following ? (
            <>
              <UserCheck size={16} />
              {mutual ? "Amigos" : "Siguiendo"}
            </>
          ) : (
            <>
              <UserPlus size={16} />
              {followsBack ? "Seguir de vuelta" : "Seguir"}
            </>
          )}
        </button>

        {following && !mutual ? (
          <button
            type="button"
            onClick={handleFollow}
            disabled={pending}
            className="flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--text-tertiary)] transition hover:border-rose-200 hover:text-rose-500"
          >
            <UserMinus size={16} />
          </button>
        ) : null}
      </div>
      {mutual ? (
        <p className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <Users size={12} />
          ¡Son amigos!
        </p>
      ) : null}

      <div className="space-y-1.5">
        {mutual ? (
          <Link
            href={`/comunidad/mensajes/${targetUserId}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/5 px-4 py-3 text-sm font-semibold text-[#0085FC] transition hover:bg-[#0085FC]/10"
          >
            <MessageSquare size={16} />
            Mandar mensaje
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/5 px-4 py-3 text-sm font-semibold text-[#0085FC] opacity-50"
          >
            <MessageSquare size={16} />
            Mandar mensaje
          </button>
        )}
        {!mutual ? (
          <p className="text-center text-xs text-[var(--text-tertiary)]">Seguíos mutuamente para chatear</p>
        ) : null}
      </div>

      <AppleToast message={toast} />
    </div>
  );
}
