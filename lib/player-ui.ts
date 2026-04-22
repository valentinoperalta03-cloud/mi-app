// Clean white card — Apple Notes style
export const PLAYER_CARD =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm " +
  "dark:bg-slate-900 dark:border-slate-800";

// Interactive card with hover — Apple springy feel
export const PLAYER_CARD_INTERACTIVE =
  "cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm " +
  "transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-500/30 hover:shadow-md " +
  "active:scale-[0.99] active:translate-y-0 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/30";

// Sky blue gradient button — iOS style
export const PLAYER_PRIMARY_BUTTON =
  "rounded-2xl bg-[#0585FC] px-4 py-2 text-sm font-semibold text-white dark:bg-sky-500 " +
  "shadow-[0_2px_8px_rgba(5,133,252,0.3)] " +
  "transition-all duration-200 " +
  "hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(5,133,252,0.4)] " +
  "active:scale-[0.98] active:translate-y-0";

// Ghost secondary button
export const PLAYER_SECONDARY_BUTTON =
  "rounded-2xl border border-black/[0.08] bg-white/80 " +
  "px-4 py-2 text-sm font-semibold text-slate-700 " +
  "shadow-[0_1px_2px_rgba(0,0,0,0.04)] " +
  "transition-all duration-200 " +
  "hover:border-[#0585FC]/20 hover:bg-[#0585FC]/5 hover:text-[#0461C4] " +
  "active:scale-[0.98] " +
  "dark:border-white/[0.08] dark:bg-slate-800 dark:text-slate-200";

// Highlighted card — subtle sky tint
export const PLAYER_CARD_HIGHLIGHT =
  "rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 " +
  "shadow-sm dark:border-[#0585FC]/20 dark:bg-[#0585FC]/10";
