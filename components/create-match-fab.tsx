import Link from "next/link";
import { Plus } from "lucide-react";

export function CreateMatchFab({ href = "/crear-partido" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0585FC] to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
    >
      <Plus size={18} strokeWidth={2.5} aria-hidden />
      Crear Partido
    </Link>
  );
}
