"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createPostAction } from "@/app/(player)/comunidad/actions";
import { initialCreatePostState, type CreatePostState } from "@/app/(player)/comunidad/post-types";

export type LatestMatch = {
  match_id: string;
  scoreLabel: string;
} | null;

type PostModalProps = {
  open: boolean;
  sessionKey: number;
  latestMatch: LatestMatch;
  onClose: () => void;
};

function PostModal({ open, sessionKey, latestMatch, onClose }: PostModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/35 p-4 backdrop-blur-[3px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <CreatePostForm key={sessionKey} latestMatch={latestMatch} onRequestClose={onClose} />
      </div>
    </div>
  );
}

type CreatePostFormProps = {
  latestMatch: LatestMatch;
  onRequestClose: () => void;
};

type PostType = "text" | "photo" | "result";

function CreatePostForm({ latestMatch, onRequestClose }: CreatePostFormProps) {
  const [postType, setPostType] = useState<PostType>("text");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    createPostAction,
    initialCreatePostState as CreatePostState
  );
  const wasPending = useRef(false);
  const tabs: { type: PostType; label: string; icon: string }[] = [
    { type: "text", label: "Texto", icon: "✏️" },
    { type: "photo", label: "Foto", icon: "📸" },
    { type: "result", label: "Resultado", icon: "🏆" },
  ];

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

      <div className="mb-4 grid grid-cols-3 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => setPostType(tab.type)}
            className={`rounded-2xl py-2.5 text-sm font-semibold transition ${
              postType === tab.type
                ? "bg-[#0585FC] text-white"
                : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="post_type" value={postType} />
        <textarea
          name="content"
          required
          rows={postType === "photo" ? 2 : 4}
          placeholder={
            postType === "text"
              ? "¿Qué querés compartir?"
              : postType === "photo"
                ? "Descripción de la foto..."
                : "Contá cómo te fue en el partido..."
          }
          disabled={pending}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#0585FC] focus:ring-2 focus:ring-[#0585FC]/20 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        {postType === "photo" ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              name="image"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setImagePreview((ev.target?.result as string) ?? null);
                  reader.readAsDataURL(file);
                }
              }}
            />
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview local de archivo en cliente */}
                <img src={imagePreview} alt="preview" className="max-h-48 w-full rounded-2xl object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 transition-colors hover:border-[#0585FC]/30 hover:text-[#0585FC] dark:border-slate-700"
              >
                📸 Tocá para subir una foto
              </button>
            )}
          </div>
        ) : null}

        {postType === "result" && latestMatch ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <input
              type="checkbox"
              name="link_match"
              defaultChecked
              disabled={pending}
              className="mt-1 h-4 w-4 text-[#0585FC]"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              <span className="block font-semibold">Vincular resultado</span>
              <span className="text-xs text-slate-500">{latestMatch.scoreLabel}</span>
            </span>
          </label>
        ) : null}
        {postType === "result" && !latestMatch ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            No tenés resultados recientes para vincular.
          </p>
        ) : null}

        {state.message && !state.ok ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-[#0585FC] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0461C4] disabled:opacity-50"
        >
          {pending ? "Publicando..." : "Publicar"}
        </button>
      </form>
    </>
  );
}

export function ParaTiCreatePost({ latestMatch }: { latestMatch: LatestMatch }) {
  const [open, setOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSessionKey((k) => k + 1);
  }, []);

  return <PostModal open={open} sessionKey={sessionKey} latestMatch={latestMatch} onClose={handleClose} />;
}

export function ParaTiCreatePostButton({ latestMatch }: { latestMatch: LatestMatch }) {
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
      <button
        type="button"
        onClick={handleOpen}
        className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#0585FC] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(5,133,252,0.45)] transition active:scale-[0.97]"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        Publicar
      </button>

      <PostModal open={open} sessionKey={sessionKey} latestMatch={latestMatch} onClose={handleClose} />
    </>
  );
}
