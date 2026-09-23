/**
 * Cancha de pádel esquemática y reconocible: rectángulo horizontal, red central,
 * líneas de saque y muro perimetral (doble línea = vidrio). Usada como base visual
 * en todos los gráficos que representan una cancha, para que "se lea" pádel al toque.
 */
export default function PadelCourt({
  className = "",
  fill = "#EAF6FF",
  line = "#8FC7F7",
  net = "#0461C4",
  wall = "#BFDBFE",
}: {
  className?: string;
  fill?: string;
  line?: string;
  net?: string;
  wall?: string;
}) {
  return (
    <svg viewBox="0 0 200 100" className={className} aria-hidden="true">
      {/* muro perimetral (vidrio) */}
      <rect x="2" y="2" width="196" height="96" rx="6" fill="none" stroke={wall} strokeWidth="3" />
      {/* superficie */}
      <rect x="8" y="8" width="184" height="84" rx="3" fill={fill} />
      {/* líneas de cancha */}
      <g stroke={line} strokeWidth="1.6" fill="none">
        <rect x="8" y="8" width="184" height="84" rx="3" />
        <line x1="58" y1="8" x2="58" y2="92" />
        <line x1="142" y1="8" x2="142" y2="92" />
        <line x1="58" y1="50" x2="142" y2="50" />
      </g>
      {/* red */}
      <line x1="100" y1="6" x2="100" y2="94" stroke={net} strokeWidth="3.5" />
      <circle cx="100" cy="50" r="2.4" fill={net} />
    </svg>
  );
}
