/** Patrón decorativo: líneas de cancha de pádel estilizadas, usadas como textura de fondo (no como contenido). */
export default function CourtLines({
  className = "",
  color = "#FFFFFF",
  opacity = 0.14,
}: {
  className?: string;
  color?: string;
  opacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 400 240"
      className={className}
      style={{ opacity }}
      fill="none"
      stroke={color}
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x="10" y="10" width="380" height="220" rx="10" />
      <line x1="200" y1="10" x2="200" y2="230" />
      <line x1="105" y1="10" x2="105" y2="230" strokeOpacity={0.6} />
      <line x1="295" y1="10" x2="295" y2="230" strokeOpacity={0.6} />
      <line x1="10" y1="120" x2="390" y2="120" strokeDasharray="5 6" strokeOpacity={0.7} />
    </svg>
  );
}
