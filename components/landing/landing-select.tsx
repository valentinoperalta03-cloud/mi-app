"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export type LandingSelectOption = { value: string; label: string; hint?: string };

type Props = {
  id: string;
  labelId: string;
  options: readonly LandingSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  describedBy?: string;
  disabled?: boolean;
  /** Contenido del botón cuando hay selección (por defecto, el label). */
  renderValue?: (option: LandingSelectOption) => ReactNode;
  buttonClassName?: string;
  popupClassName?: string;
};

/**
 * Listbox accesible (patrón WAI-ARIA "select-only"): mouse, touch y teclado
 * (flechas, Home/End, Enter/Espacio, Escape, Tab y búsqueda por letra).
 */
export default function LandingSelect({
  id,
  labelId,
  options,
  value,
  onChange,
  placeholder = "Elegí una opción",
  describedBy,
  disabled,
  renderValue,
  buttonClassName = "",
  popupClassName = "",
}: Props) {
  const listId = useId();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function openList(index = selectedIndex >= 0 ? selectedIndex : 0) {
    if (disabled) return;
    setActive(index);
    setOpen(true);
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function choose(i: number) {
    onChange(options[i].value);
    close(true);
  }

  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      if (e.key === "ArrowUp") openList(selectedIndex >= 0 ? selectedIndex : options.length - 1);
      else openList();
    }
  }

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        return;
      case "Escape":
        e.preventDefault();
        close(true);
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const match = options.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
      if (match >= 0) setActive(match);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${id}`}
        aria-describedby={describedBy}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onButtonKeyDown}
        className={`flex w-full items-center justify-between gap-3 text-left outline-none transition disabled:opacity-60 ${buttonClassName}`}
      >
        <span className={`min-w-0 flex-1 line-clamp-2 ${selected ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
          {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-[#0461C4] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={optionId(active)}
            onKeyDown={onListKeyDown}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{ transformOrigin: "top" }}
            className={`absolute left-0 top-full z-40 mt-2 max-h-80 w-full overflow-y-auto overscroll-contain rounded-2xl border border-[#DCEBFF] bg-white p-1.5 shadow-[0_24px_60px_-24px_rgba(4,97,196,0.45)] outline-none ${popupClassName}`}
          >
            {options.map((o, i) => {
              const isSelected = o.value === value;
              const isActive = i === active;
              return (
                <li
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isActive ? "bg-[#EAF3FF]" : ""
                  } ${isSelected ? "font-bold text-[#031733]" : "font-medium text-[#334155]"}`}
                >
                  <span className="min-w-0 flex-1">
                    {o.label}
                    {o.hint ? <span className="ml-1.5 font-semibold text-[#64748B]">{o.hint}</span> : null}
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
                      isSelected ? "bg-[#CCFF00] text-[#1F2900]" : "text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
