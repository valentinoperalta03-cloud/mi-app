/** Pesos por pregunta (1–10). */
export const QUIZ_WEIGHTS = [1, 0.8, 1.5, 1.5, 1.3, 1.2, 1.3, 1.2, 1, 0.5] as const;

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

const SCALE_LABELS = ["Muy bajo", "Bajo", "Medio", "Alto", "Muy alto"] as const;

export function scaleLabel(n: number): string {
  return SCALE_LABELS[Math.max(0, Math.min(4, n - 1))] ?? "";
}

export type LevelComputation = {
  weightedAvg: number;
  afterPenalty: number;
  penaltyApplied: boolean;
  selfAssessmentWarning: boolean;
  category: string;
};

/** Promedio ponderado de las preguntas 1–9 (sin autoevaluación). */
function weightedAvgFirstNine(answers: number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < 9; i++) {
    num += answers[i] * QUIZ_WEIGHTS[i];
    den += QUIZ_WEIGHTS[i];
  }
  return num / den;
}

export function computeLevelFromAnswers(answers: number[]): LevelComputation {
  if (answers.length !== 10 || answers.some((a) => a < 1 || a > 5 || !Number.isFinite(a))) {
    throw new Error("Respuestas inválidas");
  }

  let num = 0;
  let den = 0;
  for (let i = 0; i < 10; i++) {
    num += answers[i] * QUIZ_WEIGHTS[i];
    den += QUIZ_WEIGHTS[i];
  }
  const weightedAvg = num / den;

  const experienceAvg = (answers[0] + answers[1]) / 2;
  const techniqueAvg = (answers[2] + answers[3] + answers[4] + answers[5]) / 4;
  const penaltyApplied = experienceAvg < 2.5 && techniqueAvg > 4;
  const afterPenalty = penaltyApplied ? weightedAvg * 0.8 : weightedAvg;

  const refNine = weightedAvgFirstNine(answers);
  const selfAssessmentWarning = Math.abs(answers[9] - refNine) > 1.5;

  const category = classifyCategory(afterPenalty);

  return {
    weightedAvg,
    afterPenalty,
    penaltyApplied,
    selfAssessmentWarning,
    category,
  };
}

/**
 * Rangos más exigentes para 1ra–4ta. Elite (1ra–2da): 4.80–5.00 (tope teórico del cuestionario).
 */
export function classifyCategory(score: number): string {
  if (score >= 4.8) return "1ra–2da (Elite)";
  if (score >= 4.52) return "1ra–2da";
  if (score >= 3.95) return "3ra–4ta";
  if (score >= 3.22) return "5ta–6ta";
  if (score >= 2.5) return "7ma";
  return "8va";
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
