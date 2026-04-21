// Clean white card — Apple Notes style
export const PLAYER_CARD =
  "rounded-2xl bg-white border border-black/[0.06] " +
  "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] " +
  "dark:bg-slate-900 dark:border-white/[0.06]";

// Interactive card with hover — Apple springy feel
export const PLAYER_CARD_INTERACTIVE =
  "rounded-2xl bg-white border border-black/[0.06] " +
  "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] " +
  "transition-all duration-200 ease-out " +
  "hover:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] " +
  "hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0 " +
  "dark:bg-slate-900 dark:border-white/[0.06] " +
  "dark:hover:border-sky-800/50";

// Sky blue gradient button — iOS style
export const PLAYER_PRIMARY_BUTTON =
  "rounded-2xl px-4 py-2 text-sm font-semibold text-white " +
  "shadow-[0_2px_8px_rgba(37,99,235,0.3)] " +
  "transition-all duration-200 " +
  "hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(37,99,235,0.4)] " +
  "active:scale-[0.98] active:translate-y-0";

// Ghost secondary button
export const PLAYER_SECONDARY_BUTTON =
  "rounded-2xl border border-black/[0.08] bg-white/80 " +
  "px-4 py-2 text-sm font-semibold text-slate-700 " +
  "shadow-[0_1px_2px_rgba(0,0,0,0.04)] " +
  "transition-all duration-200 " +
  "hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 " +
  "active:scale-[0.98] " +
  "dark:border-white/[0.08] dark:bg-slate-800 dark:text-slate-200";

// Highlighted card — subtle sky tint
export const PLAYER_CARD_HIGHLIGHT =
  "rounded-2xl bg-gradient-to-br from-sky-50 to-white " +
  "border border-sky-100/80 " +
  "shadow-[0_1px_3px_rgba(14,165,233,0.08),0_4px_16px_rgba(14,165,233,0.06)] " +
  "dark:from-sky-950/30 dark:to-slate-900 dark:border-sky-900/30";
