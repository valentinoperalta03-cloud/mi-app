"use client";

import { useEffect, useState } from "react";

function getArHourLabel() {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function CurrentArTime({ className }: { className?: string }) {
  const [value, setValue] = useState(getArHourLabel());

  useEffect(() => {
    const timer = setInterval(() => setValue(getArHourLabel()), 30000);
    return () => clearInterval(timer);
  }, []);

  return <p className={className}>Hora Argentina: {value}</p>;
}
