"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggleButton() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  function cycleTheme() {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  }

  const isDark = resolvedTheme === "dark";
  const isSystem = theme === "system";

  const label = isSystem ? "Automático" : isDark ? "Modo oscuro" : "Modo claro";
  const sublabel = isSystem
    ? "Sigue la configuración del celular"
    : isDark
      ? "Tocá para cambiar a automático"
      : "Tocá para cambiar a oscuro";

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="flex w-full items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-4 transition hover:border-[var(--admin-brand-primary)]/20 hover:bg-[var(--admin-brand-primary)]/5"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-subtle)] transition-all">
          {isSystem ? (
            <Monitor size={18} className="text-[var(--admin-brand-primary)]" />
          ) : isDark ? (
            <Moon size={18} className="text-[var(--admin-brand-primary)]" />
          ) : (
            <Sun size={18} className="text-amber-500" />
          )}
        </span>
        <div className="text-left">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{sublabel}</p>
        </div>
      </div>
      <div
        className={`flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${isDark ? "bg-[var(--admin-brand-primary)]" : isSystem ? "bg-[var(--admin-brand-primary)]/50" : "bg-[var(--bg-subtle)]"}`}
      >
        <div
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${isDark ? "translate-x-5" : isSystem ? "translate-x-[0.625rem]" : "translate-x-0.5"}`}
        />
      </div>
    </button>
  );
}
