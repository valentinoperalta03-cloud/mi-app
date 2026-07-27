"use client";

import { Clock, UserCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeFriend, sendFriendRequest } from "@/app/(player)/jugador/[userId]/actions";
import { AppleToast } from "@/components/apple-toast";

type FriendStatus = "none" | "pending_sent" | "pending_received" | "friends";

export function FavoritePlayerButton({
  targetUserId,
  initialStatus,
}: {
  targetUserId: string;
  initialStatus: FriendStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FriendStatus>(initialStatus);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2600);
  }

  function handleClick() {
    startTransition(async () => {
      if (status === "none") {
        const res = await sendFriendRequest(targetUserId);
        if (res.ok) {
          setStatus("pending_sent");
          showToast("Solicitud enviada");
        } else showToast(res.message);
      } else if (status === "friends") {
        const res = await removeFriend(targetUserId);
        if (res.ok) {
          setStatus("none");
          showToast("Amigo eliminado");
        } else showToast(res.message);
      }
      router.refresh();
    });
  }

  const config = {
    none: {
      icon: UserPlus,
      label: "Agregar amigo",
      className: "bg-[#0085FC] text-white border-[#0085FC]",
    },
    pending_sent: {
      icon: Clock,
      label: "Solicitud enviada",
      className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    },
    pending_received: {
      icon: UserCheck,
      label: "Responder solicitud",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    },
    friends: {
      icon: UserCheck,
      label: "Amigos",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    },
  }[status];

  const Icon = config.icon;

  return (
    <>
      <button
        type="button"
        disabled={pending || status === "pending_sent"}
        onClick={handleClick}
        className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-60 ${config.className}`}
      >
        <Icon size={16} />
        {config.label}
      </button>
      <AppleToast message={toast} />
    </>
  );
}
