/** Mide insets reales cuando env(safe-area-inset-*) devuelve 0 en WKWebView. */
export function measureNativeSafeAreaInsets(): { top: number; bottom: number } {
  if (typeof document === "undefined") {
    return { top: 0, bottom: 0 };
  }

  const probe = document.createElement("div");
  probe.setAttribute(
    "style",
    "position:fixed;top:0;left:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);visibility:hidden;pointer-events:none"
  );
  document.documentElement.appendChild(probe);
  const style = getComputedStyle(probe);
  const top = parseFloat(style.paddingTop) || 0;
  const bottom = parseFloat(style.paddingBottom) || 0;
  probe.remove();

  return { top, bottom };
}

export function applyNativeSafeAreaCssVars(root: HTMLElement): void {
  const { top, bottom } = measureNativeSafeAreaInsets();

  if (top > 0) {
    root.style.setProperty("--cap-safe-top", `${top}px`);
  } else if (root.classList.contains("capacitor-native") && !root.classList.contains("capacitor-ipad")) {
    // WKWebView a veces reporta 0 hasta que overlay + viewport-fit=cover aplican.
    const inset = Math.max(0, window.screen.height - window.innerHeight);
    if (inset > 20 && inset < 100) {
      root.style.setProperty("--cap-safe-top", `${inset}px`);
    }
  }
  if (bottom > 0) {
    root.style.setProperty("--cap-safe-bottom", `${bottom}px`);
  }

  root.style.setProperty("--status-bar-height", `var(--cap-safe-top, env(safe-area-inset-top, 0px))`);
}
