"use client";

/**
 * Toast tipo iOS: píldora oscura, blur suave, sin iconos pesados.
 */
export function AppleToast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-28 left-1/2 z-[95] max-w-[min(92vw,340px)] -translate-x-1/2 transition-opacity duration-300"
    >
      <div className="rounded-2xl border border-white/10 bg-[#1c1c1e]/88 px-5 py-3 text-center text-[15px] font-medium leading-snug text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        {message}
      </div>
    </div>
  );
}
