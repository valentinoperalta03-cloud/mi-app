"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-[#0585FC]/20 hover:bg-[#0585FC]/5 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-[#0585FC]/20"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 transition-all dark:bg-slate-700">
          <Sun
            size={18}
            className={`absolute text-amber-500 transition-all duration-300 ${isDark ? "scale-50 opacity-0" : "scale-100 opacity-100"}`}
          />
          <Moon
            size={18}
            className={`absolute text-[#0585FC] transition-all duration-300 ${isDark ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
          />
        </span>
        <div className="text-left">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">
            {isDark ? "Modo oscuro" : "Modo claro"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isDark ? "Tocá para cambiar a claro" : "Tocá para cambiar a oscuro"}
          </p>
        </div>
      </div>
      <div className={`flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${isDark ? "bg-[#0585FC]" : "bg-slate-200 dark:bg-slate-600"}`}>
        <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${isDark ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
    </button>
  );
}
