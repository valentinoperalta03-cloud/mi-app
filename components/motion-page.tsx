import type { ReactNode } from "react";

/** Contenedor de página; las transiciones viven en app/(player)/template.tsx */
export default function MotionPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
