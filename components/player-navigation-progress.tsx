"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PlayerNavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 450);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="player-nav-progress pointer-events-none fixed inset-x-0 z-40 h-0.5 max-h-0.5 touch-none overflow-hidden"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      aria-hidden
    >
      <div className="player-nav-progress-bar pointer-events-none h-full w-2/5 rounded-full bg-sky-300" />
    </div>
  );
}
