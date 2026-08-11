import { Info } from "lucide-react";
import type { ReactNode } from "react";

export default function AdminGuideBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details
      className="group overflow-hidden rounded-xl border"
      style={{ backgroundColor: "rgba(0,133,252,0.06)", borderColor: "rgba(0,133,252,0.15)" }}
    >
      <summary className="flex cursor-pointer select-none items-center gap-2.5 px-5 py-4 text-sm font-semibold text-[var(--text-primary)] marker:content-none">
        <Info size={18} className="shrink-0 text-[#0085FC]" />
        {title}
        <span className="ml-auto text-xs font-normal text-[#0085FC] group-open:hidden">Ver guía</span>
        <span className="ml-auto hidden text-xs font-normal text-[#0085FC] group-open:inline">Cerrar</span>
      </summary>
      <div
        className="space-y-4 border-t px-5 pb-5 pt-4 text-sm text-[var(--text-secondary)]"
        style={{ borderColor: "rgba(0,133,252,0.15)" }}
      >
        {children}
      </div>
    </details>
  );
}
