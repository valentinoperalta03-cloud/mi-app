"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

const NATIVE_DRAG_FREE =
  "a, button, [role='button'], .btn-primary, .btn-primary-gradient";

function disableNativeDrag(el: Element) {
  if (el instanceof HTMLElement) {
    el.setAttribute("draggable", "false");
  }
}

function applyNativeDragFree(root: ParentNode) {
  root.querySelectorAll(NATIVE_DRAG_FREE).forEach(disableNativeDrag);
}

/**
 * Avisa al splash nativo que el shell principal ya pintó (home, login, etc.).
 * No renderiza DOM: no puede bloquear scroll ni capturar eventos táctiles.
 */
export default function CapacitorShellReady() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("capacitor-shell-ready"));

    if (!Capacitor.isNativePlatform()) return;

    applyNativeDragFree(document);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            disableNativeDrag(node);
            applyNativeDragFree(node);
          }
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
