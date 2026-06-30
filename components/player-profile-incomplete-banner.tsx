import Link from "next/link";
import { TriangleAlert } from "lucide-react";

type Props = {
  hasName: boolean;
  hasGender: boolean;
  hasOnboarding: boolean;
};

export default function PlayerProfileIncompleteBanner({ hasName, hasGender, hasOnboarding }: Props) {
  const completedCount = [hasName, hasGender, hasOnboarding].filter(Boolean).length;
  const pct = Math.round((completedCount / 3) * 100);

  return (
    <section
      className="overflow-hidden rounded-3xl p-5"
      style={{ background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <TriangleAlert className="h-5 w-5 shrink-0 text-white" />
        <p className="text-sm font-bold text-white uppercase tracking-wide">
          Perfil incompleto
        </p>
      </div>

      <p className="text-sm text-red-100 mb-4 leading-snug">
        Para unirte o crear tu primer partido necesitás completar tu perfil con tu nombre, género y nivel de juego.
      </p>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center justify-between text-xs text-red-200">
          <span>Completado</span>
          <span className="font-bold text-white">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-red-900/50">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Link
        href="/onboarding"
        className="flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-red-600 transition active:scale-[0.98] active:bg-red-50"
      >
        Completar perfil ahora →
      </Link>
    </section>
  );
}
