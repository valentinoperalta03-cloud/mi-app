import type { OnboardingAnswers } from "@/lib/onboarding-level-calculator";

export type OnboardingQuestionKey = keyof OnboardingAnswers;

export type OnboardingQuestionOption = {
  value: OnboardingAnswers[OnboardingQuestionKey];
  label: string;
};

export type OnboardingQuestion = {
  key: OnboardingQuestionKey;
  emoji: string;
  question: string;
  options: OnboardingQuestionOption[];
};

/** 8 pantallas individuales, una por pregunta (P1–P8). */
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    key: "p1",
    emoji: "⏱️",
    question: "¿Hace cuánto jugás?",
    options: [
      { value: "less_6m", label: "Menos de 6 meses" },
      { value: "6m_2y", label: "6 meses a 2 años" },
      { value: "2y_5y", label: "2 a 5 años" },
      { value: "5y_10y", label: "5 a 10 años" },
      { value: "more_10y", label: "Más de 10 años" },
    ],
  },
  {
    key: "p2",
    emoji: "📅",
    question: "¿Con qué frecuencia jugás?",
    options: [
      { value: "less_monthly", label: "Menos de una vez por mes" },
      { value: "1_3_monthly", label: "1 a 3 veces por mes" },
      { value: "weekly", label: "Una vez por semana" },
      { value: "2_3_weekly", label: "2 a 3 veces por semana" },
      { value: "daily", label: "4 o más veces por semana" },
    ],
  },
  {
    key: "p3",
    emoji: "🏆",
    question: "¿Jugaste torneos?",
    options: [
      { value: "never", label: "Nunca jugué un torneo" },
      { value: "tried", label: "Probé alguna vez" },
      { value: "amateur", label: "Juego amateur regularmente" },
      { value: "federated", label: "Compito en torneos federados" },
      { value: "ranked", label: "Tengo ranking federado activo" },
    ],
  },
  {
    key: "p4",
    emoji: "📊",
    question: "¿Cómo te va contra jugadores de tu nivel?",
    options: [
      { value: "lose_most", label: "Pierdo la mayoría de los partidos" },
      { value: "even", label: "Gano y pierdo por partes iguales" },
      { value: "win_half", label: "Gano más de la mitad" },
      { value: "win_most", label: "Casi siempre gano" },
      { value: "always_win", label: "Siempre gano, me quedo corto de nivel" },
    ],
  },
  {
    key: "p5",
    emoji: "🎯",
    question: "¿Cómo es tu situación en la pared del fondo?",
    options: [
      { value: "cant", label: "Me cuesta llegar, la pelota me gana" },
      { value: "inconsistent", label: "Llego pero el remate me sale inconsistente" },
      { value: "controlled", label: "Controlo y devuelvo con dirección" },
      { value: "with_effect", label: "Juego con efecto y variación" },
      { value: "weapon", label: "Es una de mis armas principales" },
    ],
  },
  {
    key: "p6",
    emoji: "🏸",
    question: "¿Cómo es tu juego en la red?",
    options: [
      { value: "avoid", label: "Me cuesta, prefiero quedarme en el fondo" },
      { value: "basic", label: "La uso pero sin mucha agresividad" },
      { value: "solid", label: "Sólida, cierro puntos en la red" },
      { value: "aggressive", label: "Agresiva y variada" },
      { value: "best", label: "Es mi punto más fuerte" },
    ],
  },
  {
    key: "p7",
    emoji: "👥",
    question: "¿Qué nivel se consideran tus compañeros?",
    options: [
      { value: "octava", label: "8va o no sé" },
      { value: "septima", label: "7ma" },
      { value: "sexta", label: "6ta" },
      { value: "quinta", label: "5ta" },
      { value: "cuarta_plus", label: "4ta o más" },
    ],
  },
  {
    key: "p8",
    emoji: "🎾",
    question: "¿Qué nivel solés decir que sos?",
    options: [
      { value: "octava", label: "8va o no sé" },
      { value: "septima", label: "7ma" },
      { value: "sexta", label: "6ta" },
      { value: "quinta", label: "5ta" },
      { value: "cuarta_plus", label: "4ta o más" },
    ],
  },
];
