"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  createPostAction,
  initialCreatePostState,
  type CreatePostState,
} from "@/app/(player)/comunidad/actions";

type LatestMatch = {
  match_id: string;
  scoreLabel: string;
} | null;

type CreatePostFormProps = {
  latestMatch: LatestMatch;
  onRequestClose: () => void;
};

function CreatePostForm({ latestMatch, onRequestClose }: CreatePostFormProps) {
  const [state, formAction, pending] = useActionState(
    createPostAction,
    initialCreatePostState as CreatePostState
  );
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      onRequestClose();
    }
    wasPending.current = pending;
  }, [pending, state.ok, onRequestClose]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="post-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
          Nueva publicación
        </h2>
        <button
          type="button"
          onClick={onRequestClose}
          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Cerrar"
        >
          <X size={22} aria-hidden />
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        <textarea
          name="content"
          required
          rows={5}
          placeholder="¿Qué querés compartir?"
          disabled={pending}
          className="w-full resize-none rounded-[2rem] border border-slate-300 dark:border-slate-700 bg-transparent dark:bg-slate-950 px-4 py-3.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0585FC] focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-[#0585FC]/20/50"
        />

        {latestMatch ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
            <input
              type="checkbox"
              name="link_match"
              disabled={pending}
              className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-[#0585FC] disabled:opacity-50"
            />
            <span className="text-sm leading-snug text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                Vincular resultado de mi último partido
              </span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {latestMatch.scoreLabel}
              </span>
            </span>
          </label>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">No hay un resultado reciente para vincular.</p>
        )}

        {state.message && !state.ok ? (
          <p className="rounded-2xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            {state.message}
          </p>
        ) : null}
        {state.ok && state.message ? (
          <p className="rounded-2xl border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[2rem] bg-[#0461C4] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0585FC]/50 disabled:opacity-50"
        >
          {pending ? "Publicando…" : "Publicar"}
        </button>
      </form>
    </>
  );
}

export function ParaTiCreatePost({ latestMatch }: { latestMatch: LatestMatch }) {
  const [open, setOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  const handleOpen = useCallback(() => {
    setSessionKey((k) => k + 1);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSessionKey((k) => k + 1);
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2">
        <div className="pointer-events-auto relative h-full w-full">
          <div className="absolute bottom-28 right-4">
            <button
              type="button"
              onClick={handleOpen}
              aria-label="Nueva publicación"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0461C4] text-white shadow-[0_12px_40px_-8px_rgba(2,132,199,0.55)] ring-4 ring-white/90 transition hover:bg-[#0585FC]/50 hover:shadow-lg active:scale-95"
            >
              <Plus size={28} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/35 p-4 backdrop-blur-[3px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            className="w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <CreatePostForm
              key={sessionKey}
              latestMatch={latestMatch}
              onRequestClose={handleClose}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
