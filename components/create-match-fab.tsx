import Link from "next/link";
import { Plus } from "lucide-react";

export function CreateMatchFab({ href = "/crear-partido" }: { href?: string }) {
  return (
    <div className="fixed z-40" style={{ bottom: "calc(env(safe-area-inset-bottom) + 7rem)", right: "1rem" }}>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0085FC] to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 active:scale-[0.97]"
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden />
        Crear Partido
      </Link>
    </div>
  );
}
