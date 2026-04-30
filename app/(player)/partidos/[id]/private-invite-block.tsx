"use client";

import { useCallback, useState } from "react";

type Props = {
  inviteUrl: string;
};

export default function PrivateInviteBlock({ inviteUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [inviteUrl]);

  return (
    <section className="rounded-2xl border border-[#0585FC]/20/80 bg-[#0585FC]/5/80 p-5 shadow-sm">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">Invitar jugadores</h2>
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
        Compartí este link con los jugadores que querés invitar.
      </p>
      <p className="mt-3 break-all rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800">
        {inviteUrl}
      </p>
      <button
        type="button"
        onClick={() => void onCopy()}
        className="btn-primary-gradient mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition hover:brightness-95"
      >
        {copied ? "¡Copiado!" : "Copiar link"}
      </button>
    </section>
  );
}
