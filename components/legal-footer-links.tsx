"use client";

import Link from "next/link";

export function LegalFooterLinks({
  variant,
  className = "",
}: {
  variant: "login" | "profile";
  className?: string;
}) {
  const wrap =
    variant === "login"
      ? "text-center text-xs leading-relaxed text-slate-400"
      : "text-center text-sm leading-relaxed text-slate-500";

  const link =
    variant === "login"
      ? "text-slate-400 underline decoration-slate-300/60 underline-offset-[3px] transition-colors hover:text-slate-500 hover:decoration-slate-400/80"
      : "text-slate-500 underline decoration-slate-300/70 underline-offset-[3px] transition-colors hover:text-slate-600 hover:decoration-slate-400/80";

  return (
    <p className={`${wrap} ${className}`.trim()}>
      <span className="font-normal">Legal: </span>
      <Link href="/legal/terminos" className={`${link} bg-transparent p-0 font-medium`}>
        Términos de Uso
      </Link>
      <span className="font-normal"> y </span>
      <Link href="/legal/privacidad" className={`${link} bg-transparent p-0 font-medium`}>
        Política de Privacidad
      </Link>
    </p>
  );
}
