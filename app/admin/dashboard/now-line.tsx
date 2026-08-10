"use client";

import { useEffect, useState } from "react";

function argentinaNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function formatHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function NowLine({
  gridStartMin,
  gridEndMin,
  pxPerHour,
  axisWidth,
}: {
  gridStartMin: number;
  gridEndMin: number;
  pxPerHour: number;
  axisWidth: number;
}) {
  const [nowMin, setNowMin] = useState<number | null>(null);

  useEffect(() => {
    setNowMin(argentinaNowMinutes());
    const id = setInterval(() => setNowMin(argentinaNowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (nowMin == null) return null;
  if (nowMin < gridStartMin || nowMin > gridEndMin) return null;

  const top = ((nowMin - gridStartMin) / 60) * pxPerHour;

  return (
    <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top }}>
      <span
        className="shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-bold text-white"
        style={{ width: axisWidth - 6, background: "#EF4444" }}
      >
        {formatHHMM(nowMin)}
      </span>
      <div className="h-[2px] flex-1" style={{ background: "#EF4444" }} />
    </div>
  );
}
