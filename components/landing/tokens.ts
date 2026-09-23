/** Paleta y gradientes compartidos entre home y /para-clubes. Basados en los tokens oficiales de marca (tailwind.config.ts: brand.primary/secondary/lima/navy). */

export const COLOR = {
  blue: "#0085FC",
  blueDark: "#0461C4",
  celeste: "#7DD3FC",
  lima: "#CCFF00",
  limaText: "#4a5a00",
  navy: "#031733",
  ink: "#0F172A",
  slate: "#64748B",
  line: "#DCEBFF",
} as const;

/** Hero: azul intenso arriba fundiéndose a celeste claro abajo. Luminoso, sin negro. */
export const heroGradient =
  "linear-gradient(165deg, #0461C4 0%, #0085FC 38%, #4FB8F7 66%, #DCEEFF 100%)";

/** Franja de color sólida para CTAs intermedios. Azul medio a celeste, nunca cerca del negro. */
export const bandGradient = "linear-gradient(120deg, #0AA0FF 0%, #0461C4 100%)";

/** Fondo suave para alternar secciones claras sin caer en blanco plano todo el tiempo. */
export const softSectionBg = "linear-gradient(180deg, #FFFFFF 0%, #EAF4FF 100%)";

/** Fondo tibio con acento lima muy sutil, para cierres comerciales sin caer en oscuro. */
export const limaSoftBg = "linear-gradient(160deg, #FBFFEF 0%, #F3FBFF 55%, #FFFFFF 100%)";

export const cardShadow = "0 20px 60px -28px rgba(4, 97, 196, 0.35)";
export const cardShadowSm = "0 14px 36px -22px rgba(4, 97, 196, 0.3)";
export const limaGlow = "0 20px 50px -22px rgba(204, 255, 0, 0.45)";
