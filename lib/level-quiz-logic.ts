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
    { score: 1, text: "<3 meses" },
    { score: 2, text: "6m-1 ano" },
    { score: 3, text: "1-2 anos" },
    { score: 4, text: "3-5 anos" },
    { score: 5, text: "+5 anos compitiendo" },
  ],
  [
    { score: 1, text: "Eventual" },
    { score: 2, text: "1 vez/semana" },
    { score: 3, text: "2 veces/semana" },
    { score: 4, text: "3-4 veces/semana" },
    { score: 5, text: "Casi a diario" },
  ],
  [
    { score: 1, text: "Muchos errores" },
    { score: 2, text: "Paso la red sin direccion" },
    { score: 3, text: "Peloteos largos con control" },
    { score: 4, text: "Manejo profundidades" },
    { score: 5, text: "Control total y efectos" },
  ],
  [
    { score: 1, text: "Las evito" },
    { score: 2, text: "Solo defensa basica" },
    { score: 3, text: "Uso pared para armar globos" },
    { score: 4, text: "Bajadas agresivas" },
    { score: 5, text: "Domino giros y contraparedes" },
  ],
  [
    { score: 1, text: "Me quedo en el fondo" },
    { score: 2, text: "Me pasan facil" },
    { score: 3, text: "Voleo con control" },
    { score: 4, text: "Aprieto volea a la reja" },
    { score: 5, text: "Domino y defino con autoridad" },
  ],
  [
    { score: 1, text: "No remato" },
    { score: 2, text: "Remato despacio" },
    { score: 3, text: "Potencia sin control" },
    { score: 4, text: "Saco la bola x3/x4 seguido" },
    { score: 5, text: "Defino desde cualquier lado" },
  ],
  [
    { score: 1, text: "No se donde pararme" },
    { score: 2, text: "Subo/bajo basico" },
    { score: 3, text: "Cubro espacios y globos tacticos" },
    { score: 4, text: "Manejo ritmos de partido" },
    { score: 5, text: "Leo al rival y me anticipo" },
  ],
  [
    { score: 1, text: "Nunca" },
    { score: 2, text: "Americanos/Internos" },
    { score: 3, text: "7ma o 6ta cat" },
    { score: 4, text: "5ta o 4ta cat" },
    { score: 5, text: "3ra o categorias Elite" },
  ],
  [
    { score: 1, text: "Pierdo por mucho" },
    { score: 2, text: "Muchos errores no forzados" },
    { score: 3, text: "Resultados parejos" },
    { score: 4, text: "Impongo mi ritmo" },
    { score: 5, text: "Domino mi categoria" },
  ],
  [
    { score: 1, text: "Principiante" },
    { score: 2, text: "Iniciacion avanzada" },
    { score: 3, text: "Intermedio" },
    { score: 4, text: "Avanzado" },
    { score: 5, text: "Experto / Primera" },
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
  if (score >= 4.6) return "Experto / Primera";
  if (score >= 3.8) return "Avanzado";
  if (score >= 2.8) return "Intermedio";
  if (score >= 1.8) return "Iniciacion avanzada";
  return "Principiante";
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
