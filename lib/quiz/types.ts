/**
 * Quiz engine types (spec: docs/specs/pawsonality-quiz.md).
 * The engine is quiz-agnostic: a quiz is a published content snapshot (questions + result types).
 * Client-safe: no server imports.
 */

export type AnimalType = 'dog' | 'cat';

/** The four Pawsonality axes and their two poles (first letter = first pole). */
export const DIMENSIONS = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  BC: ['B', 'C'],
} as const;

export type Dimension = keyof typeof DIMENSIONS;
export type Pole = (typeof DIMENSIONS)[Dimension][number];
export const DIMENSION_ORDER: Dimension[] = ['EI', 'SN', 'TF', 'BC'];

/** Swipe right = "Totally my pet!", left = "Not my pet!" */
export type Swipe = 'right' | 'left';

export interface QuizQuestion {
  id: string;
  dimension: Dimension;
  /** The pole a right swipe scores; a left swipe scores the other pole. */
  rightPole: Pole;
  /** Uses the [PET_NAME] token */
  statement: string;
  shareQuote?: string | null;
  visualBrief?: string | null;
  imagePublicId?: string | null;
}

export interface QuizResultType {
  code: string; // e.g. ESFB
  name: string;
  tagline?: string | null;
  traits?: string[];
  signatureMove?: string | null;
  ownerReality?: string | null;
  shareQuote?: string | null;
  /** image_catalog design shown for this type (Pawsonalities theme) */
  designImageId?: string | null;
}

/** A published quiz version: what customers take and what results are scored against. */
export interface QuizSnapshot {
  quizId: string;
  slug: string;
  animalType: AnimalType;
  title: string;
  version: number;
  questions: QuizQuestion[];
  resultTypes: QuizResultType[];
}

export type Answers = Record<string, Swipe>;

export interface DimensionScore {
  dimension: Dimension;
  winner: Pole;
  /** Points for the winning pole */
  points: number;
  /** Questions asked on this dimension */
  total: number;
  /** points / total, 0–1 */
  strength: number;
  /** True when the two poles tied (only possible with an even question count) */
  tie: boolean;
}

export interface QuizScore {
  code: string;
  dimensions: DimensionScore[];
  /** Spec format, e.g. { E: 80, I: 20, S: 100, N: 0, … } — percentages */
  scoreData: Record<Pole, number>;
}
