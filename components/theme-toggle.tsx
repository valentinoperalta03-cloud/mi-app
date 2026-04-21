"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mode = (theme as ThemeMode | undefined) ?? "system";
  const effective = resolvedTheme ?? "light";

  if (!mounted) {
    return <div className="h-12 w-12 rounded-full" aria-hidden />;
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white dark:text-slate-200 dark:hover:bg-white/10"
        aria-label="Cambiar tema"
        onClick={() =>
          setTheme(mode === "light" ? "dark" : mode === "dark" ? "system" : "light")
        }
        title={
          mode === "light"
            ? "Tema claro (tocá para oscuro)"
            : mode === "dark"
              ? "Tema oscuro (tocá para sistema)"
              : "Tema sistema (tocá para claro)"
        }
      >
        {effective === "dark" ? <Moon size={20} /> : <Sun size={20} />}
      </button>
      <span className="pointer-events-none absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wide text-white/45 dark:text-slate-400">
        {mode === "system" ? "auto" : mode}
      </span>
    </div>
  );
}
