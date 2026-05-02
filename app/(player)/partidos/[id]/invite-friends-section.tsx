"use client";

import { useState, useTransition } from "react";
import { AppleToast } from "@/components/apple-toast";
import { invitePlayerToMatch } from "./actions";

type FriendRow = {
  user_id: string;
  name: string;
  technical_score: number | null;
};

export default function InviteFriendsSection({
  matchId,
  friends,
  sectionId,
}: {
  matchId: string;
  friends: FriendRow[];
  /** Ancla para "Invitar amigos" desde el hero del organizador */
  sectionId?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  }

  function handleInvite(targetUserId: string) {
    startTransition(async () => {
      setPendingUserId(targetUserId);
      const res = await invitePlayerToMatch(matchId, targetUserId);
      setPendingUserId(null);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setSentIds((prev) => new Set(prev).add(targetUserId));
      showToast("Invitación enviada");
    });
  }

  if (friends.length === 0) return null;

  return (
    <>
      <section id={sectionId} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm scroll-mt-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">Invitar amigos</h2>
        <ul className="mt-3 space-y-2">
          {friends.map((friend) => {
            const scoreLabel =
              friend.technical_score != null && Number.isFinite(friend.technical_score)
                ? friend.technical_score.toFixed(2)
                : "s/d";
            const sent = sentIds.has(friend.user_id);
            return (
              <li key={friend.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{friend.name}</p>
                  <p className="text-xs text-slate-500">Technical score: {scoreLabel}</p>
                </div>
                <button
                  type="button"
                  disabled={pending || sent}
                  onClick={() => handleInvite(friend.user_id)}
                  className="rounded-xl border border-[#0585FC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0585FC] transition hover:bg-[#0585FC]/5 disabled:opacity-60"
                >
                  {pendingUserId === friend.user_id ? "Enviando..." : sent ? "Invitado" : "Invitar"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <AppleToast message={toast} />
    </>
  );
}
