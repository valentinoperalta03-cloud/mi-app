/**
 * Cálculo de categoría inicial del onboarding (8 preguntas). Devuelve
 * directamente una categoría corta ('8va'..'4ta') — fuente de verdad de
 * `profiles.category`.
 */

export type OnboardingAnswers = {
  p1: "less_6m" | "6m_2y" | "2y_5y" | "5y_10y" | "more_10y";
  p2: "less_monthly" | "1_3_monthly" | "weekly" | "2_3_weekly" | "daily";
  p3: "never" | "tried" | "amateur" | "federated" | "ranked";
  p4: "lose_most" | "even" | "win_half" | "win_most" | "always_win";
  p5: "cant" | "inconsistent" | "controlled" | "with_effect" | "weapon";
  p6: "avoid" | "basic" | "solid" | "aggressive" | "best";
  p7: "octava" | "septima" | "sexta" | "quinta" | "cuarta_plus";
  p8: "octava" | "septima" | "sexta" | "quinta" | "cuarta_plus";
};

export type PlayerLevelCode = "8va" | "7ma" | "6ta" | "5ta" | "4ta";

export function calculatePlayerLevel(answers: OnboardingAnswers): PlayerLevelCode {
  let score = 0;

  // P1 — ¿Hace cuánto jugás? (máx 4)
  const p1Scores: Record<OnboardingAnswers["p1"], number> = {
    less_6m: 0,
    "6m_2y": 1,
    "2y_5y": 2,
    "5y_10y": 3,
    more_10y: 4,
  };

  // P2 — ¿Con qué frecuencia jugás? (máx 4)
  const p2Scores: Record<OnboardingAnswers["p2"], number> = {
    less_monthly: 0,
    "1_3_monthly": 1,
    weekly: 2,
    "2_3_weekly": 3,
    daily: 4,
  };

  // P3 — ¿Jugaste torneos? (máx 4)
  const p3Scores: Record<OnboardingAnswers["p3"], number> = {
    never: 0,
    tried: 1,
    amateur: 2,
    federated: 3,
    ranked: 4,
  };

  // P4 — ¿Cómo te va contra tu nivel? (máx 4)
  const p4Scores: Record<OnboardingAnswers["p4"], number> = {
    lose_most: 0,
    even: 1,
    win_half: 2,
    win_most: 3,
    always_win: 4,
  };

  // P5 — Pared del fondo (máx 1, con decimales)
  const p5Scores: Record<OnboardingAnswers["p5"], number> = {
    cant: 0,
    inconsistent: 0.25,
    controlled: 0.5,
    with_effect: 0.75,
    weapon: 1,
  };

  // P6 — Red / volea (máx 1, con decimales)
  const p6Scores: Record<OnboardingAnswers["p6"], number> = {
    avoid: 0,
    basic: 0.25,
    solid: 0.5,
    aggressive: 0.75,
    best: 1,
  };

  // P7 — Nivel de compañeros habituales (máx 2, con decimales)
  const p7Scores: Record<OnboardingAnswers["p7"], number> = {
    octava: 0,
    septima: 0.5,
    sexta: 1,
    quinta: 1.5,
    cuarta_plus: 2,
  };

  // P8 — Nivel que solés decir que sos (máx 2, con decimales)
  const p8Scores: Record<OnboardingAnswers["p8"], number> = {
    octava: 0,
    septima: 0.5,
    sexta: 1,
    quinta: 1.5,
    cuarta_plus: 2,
  };

  score += p1Scores[answers.p1] ?? 0;
  score += p2Scores[answers.p2] ?? 0;
  score += p3Scores[answers.p3] ?? 0;
  score += p4Scores[answers.p4] ?? 0;
  score += p5Scores[answers.p5] ?? 0;
  score += p6Scores[answers.p6] ?? 0;
  score += p7Scores[answers.p7] ?? 0;
  score += p8Scores[answers.p8] ?? 0;

  // Mapeo a categoría (máximo 22 → 4ta)
  if (score <= 4) return "8va";
  if (score <= 8) return "7ma";
  if (score <= 12) return "6ta";
  if (score <= 16) return "5ta";
  return "4ta";
}
