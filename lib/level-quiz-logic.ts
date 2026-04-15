export const QUIZ_QUESTIONS = [
  { id: 1, title: "Tiempo jugando", text: "¿Hace cuánto jugás pádel de forma regular?" },
  { id: 2, title: "Frecuencia", text: "¿Con qué frecuencia salís a la cancha?" },
  { id: 3, title: "Control de golpes", text: "¿Qué tan consistente es tu control de golpes (dirección y profundidad)?" },
  { id: 4, title: "Paredes", text: "¿Cómo manejás los golpes de pared (fondo y laterales)?" },
  { id: 5, title: "Red", text: "¿Cómo valorás tu juego en la red (voleas, bloqueos)?" },
  { id: 6, title: "Remate", text: "¿Qué tan efectivo es tu remate / smash?" },
  { id: 7, title: "Táctica", text: "¿Leés bien el juego (espacios, cambios de ritmo)?" },
  { id: 8, title: "Torneos", text: "¿Participás en torneos o ligas competitivas?" },
  { id: 9, title: "Resultado típico", text: "En partidos parejos, ¿cómo suelen ser tus resultados?" },
  { id: 10, title: "Autoevaluación", text: "¿Dónde te ubicarías en una escala general de nivel?" },
] as const;

export type QuizAnswerOption = {
  score: 1 | 2 | 3 | 4 | 5;
  text: string;
};

/** 5 opciones por cada pregunta (1 = principiante, 5 = experto). */
export const QUIZ_QUESTION_OPTIONS: QuizAnswerOption[][] = [
  [
    { score: 1, text: "Recien arranco (menos de 3 meses)." },
    { score: 2, text: "Entre 6 meses y 1 ano." },
    { score: 3, text: "Entre 1 y 2 anos jugando seguido." },
    { score: 4, text: "De 3 a 5 anos con experiencia." },
    { score: 5, text: "Mas de 5 anos compitiendo." },
  ],
  [
    { score: 1, text: "Una vez cada tanto / Eventual." },
    { score: 2, text: "1 vez/semana" },
    { score: 3, text: "2 veces por semana." },
    { score: 4, text: "3 a 4 veces por semana." },
    { score: 5, text: "Juego casi todos los dias o entreno." },
  ],
  [
    { score: 1, text: "Se me van muchas pelotas o le pego con el marco." },
    { score: 2, text: "Paso la red, pero sin mucha direccion." },
    { score: 3, text: "Mantengo peloteos largos con control." },
    { score: 4, text: "Manejo profundidades y angulos con intencion." },
    { score: 5, text: "Tengo control total sobre la potencia y el efecto." },
  ],
  [
    { score: 1, text: "Evito que toque la pared porque me pierdo." },
    { score: 2, text: "La paso despues del rebote pero solo para defender." },
    { score: 3, text: "Uso el rebote de fondo para armar el globo." },
    { score: 4, text: "Hago bajadas de pared con agresividad." },
    { score: 5, text: "Domino giros y paredes laterales para contraatacar." },
  ],
  [
    { score: 1, text: "Me quedo en el fondo, me da miedo subir." },
    { score: 2, text: "Subo pero me pasan facil con globos." },
    { score: 3, text: "Voleo con control y mantengo la posicion." },
    { score: 4, text: "Aprieto la volea buscando los pies o la reja." },
    { score: 5, text: "Domino la red, bloqueo y defino con autoridad." },
  ],
  [
    { score: 1, text: "No remato, paso la bola por arriba." },
    { score: 2, text: "Remato despacio para que no rebote mucho." },
    { score: 3, text: "Tengo un smash con potencia pero no siempre la traigo." },
    { score: 4, text: "Saco la bola x3 o la traigo a mi campo seguido." },
    { score: 5, text: "Es mi mejor golpe; defino desde cualquier lado." },
  ],
  [
    { score: 1, text: "No se bien donde pararme en la cancha." },
    { score: 2, text: "Entiendo lo basico de subir juntos y bajar." },
    { score: 3, text: "Se cubrir los espacios y tirar globos tacticos." },
    { score: 4, text: "Manejo los ritmos del partido y se cuando atacar." },
    { score: 5, text: "Leo el juego del rival y me anticipo a sus jugadas." },
  ],
  [
    { score: 1, text: "Nunca jugue un torneo." },
    { score: 2, text: "Jugue algun americano o torneo interno." },
    { score: 3, text: "Compito regularmente en 7ma o 6ta categoria." },
    { score: 4, text: "Soy jugador consolidado de 5ta o 4ta." },
    { score: 5, text: "Compito en 3ra, 2da o categorias de elite." },
  ],
  [
    { score: 1, text: "Suelo perder por amplia diferencia." },
    { score: 2, text: "Partidos peleados pero con muchos errores no forzados." },
    { score: 3, text: "Gano y pierdo por igual en niveles parejos." },
    { score: 4, text: "Suelo imponer mi ritmo y ganar la mayoria." },
    { score: 5, text: "Domino mi categoria actual con facilidad." },
  ],
  [
    { score: 1, text: "Principiante / Iniciacion." },
    { score: 2, text: "Iniciacion avanzada." },
    { score: 3, text: "Intermedio / Amateur activo." },
    { score: 4, text: "Avanzado / Competitivo." },
    { score: 5, text: "Experto / Nivel Primera." },
  ],
];

export type LevelComputation = {
  average: number;
  total: number;
};

export function computeLevelFromAnswers(answers: number[]): LevelComputation {
  if (
    answers.length !== QUIZ_QUESTIONS.length ||
    answers.some((a) => a < 1 || a > 5 || !Number.isFinite(a))
  ) {
    throw new Error("Respuestas inválidas");
  }

  const total = answers.reduce((acc, curr) => acc + curr, 0);
  const average = total / QUIZ_QUESTIONS.length;
  return { average, total };
}

export function classifyCategory(score: number): string {
  if (score >= 4.5) return "1ra/2da (Elite)";
  if (score >= 4.0) return "3ra (Avanzado+)";
  if (score >= 3.5) return "4ta (Avanzado)";
  if (score >= 3.0) return "5ta (Intermedio+)";
  if (score >= 2.5) return "6ta (Intermedio)";
  if (score >= 2.0) return "7ma (Iniciacion+)";
  return "8va (Principiante)";
}

/**
 * Formato oficial visible en toda la app:
 * "{Categoria} - {Descripcion}" (ej: "5ta - Intermedio+").
 */
export function formatLevel(level: number): string {
  const label = classifyCategory(level);
  const m = label.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) return label;
  const category = (m[1] ?? "").trim();
  const description = (m[2] ?? "").trim();
  return `${category} - ${description}`;
}

export type BaseLevelChoice = "principiante" | "intermedio" | "avanzado";

export const BASE_LEVEL_OPTIONS: {
  value: BaseLevelChoice;
  label: string;
  emoji: string;
}[] = [
  { value: "principiante", label: "Principiante", emoji: "🟢" },
  { value: "intermedio", label: "Intermedio", emoji: "🟡" },
  { value: "avanzado", label: "Avanzado", emoji: "🔴" },
];
