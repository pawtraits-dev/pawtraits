/**
 * Quiz admin helpers: row mapping and publish checks. Pure functions (client-safe) except
 * where noted. Spec: docs/specs/pawsonality-quiz.md (phase 2).
 */
import { DIMENSIONS, DIMENSION_ORDER, type Dimension, type Pole, type QuizQuestion, type QuizResultType } from './types';

export interface AdminQuestionRow {
  id: string;
  quiz_id: string;
  dimension: Dimension;
  right_pole: Pole;
  statement: string;
  share_quote: string | null;
  visual_brief: string | null;
  image_public_id: string | null;
  sort_order: number;
  is_active: boolean;
  updated_at?: string;
}

export interface AdminResultTypeRow {
  id: string;
  quiz_id: string;
  code: string;
  name: string;
  tagline: string | null;
  traits: string[];
  signature_move: string | null;
  owner_reality: string | null;
  share_quote: string | null;
  design_image_id: string | null;
  updated_at?: string;
}

export const DIMENSION_LABELS: Record<Dimension, string> = { EI: 'Energy', SN: 'Social', TF: 'Training', BC: 'Boldness' };

/** Pole names per species (cats' third dimension is Responsive / Own Agenda) */
export function poleLabel(pole: Pole, animal: 'dog' | 'cat'): string {
  const labels: Record<Pole, string> = {
    E: 'Energetic', I: 'Internal', S: 'Social', N: 'Neutral',
    T: animal === 'cat' ? 'Responsive' : 'Trainable', F: animal === 'cat' ? 'Own Agenda' : 'Free-spirit',
    B: 'Bold', C: 'Cautious',
  };
  return labels[pole];
}

export function toSnapshotQuestion(r: AdminQuestionRow): QuizQuestion {
  return {
    id: r.id, dimension: r.dimension, rightPole: r.right_pole, statement: r.statement,
    shareQuote: r.share_quote, visualBrief: r.visual_brief, imagePublicId: r.image_public_id,
  };
}

export function toSnapshotType(r: AdminResultTypeRow): QuizResultType {
  return {
    code: r.code, name: r.name, tagline: r.tagline, traits: r.traits || [], signatureMove: r.signature_move,
    ownerReality: r.owner_reality, shareQuote: r.share_quote, designImageId: r.design_image_id,
  };
}

export interface PublishCheck {
  /** Blocking problems: publish refused */
  errors: string[];
  /** Worth knowing, publish still allowed */
  warnings: string[];
}

/** What stops (or should give pause to) publishing the working draft. */
export function checkPublishable(questions: AdminQuestionRow[], types: AdminResultTypeRow[]): PublishCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const active = questions.filter(q => q.is_active);

  for (const dim of DIMENSION_ORDER) {
    const qs = active.filter(q => q.dimension === dim);
    const label = DIMENSION_LABELS[dim];
    if (qs.length < 3) errors.push(`${label} needs at least 3 active questions (has ${qs.length}).`);
    else if (qs.length % 2 === 0) warnings.push(`${label} has ${qs.length} active questions, so ties are possible (they go to the last answer). An odd number avoids ties.`);
    const poles = new Set(qs.map(q => q.right_pole));
    if (qs.length >= 2 && poles.size < 2) {
      warnings.push(`Every ${label} question scores ${DIMENSIONS[dim].find(p => poles.has(p))} on a right swipe, so someone who agrees with everything always gets that letter.`);
    }
  }
  if (active.length > 24) warnings.push(`${active.length} questions will take well over 90 seconds.`);

  for (const q of active) {
    if (!q.statement.includes('[PET_NAME]')) warnings.push(`"${q.statement.slice(0, 50)}…" doesn't use [PET_NAME].`);
  }
  const missingPictures = active.filter(q => !q.image_public_id).length;
  if (missingPictures) warnings.push(`${missingPictures} active question${missingPictures === 1 ? ' has' : 's have'} no picture yet (a placeholder shows).`);

  const codes = new Set(types.map(t => t.code));
  for (const e of DIMENSIONS.EI) for (const s of DIMENSIONS.SN) for (const t of DIMENSIONS.TF) for (const b of DIMENSIONS.BC) {
    const code = e + s + t + b;
    if (!codes.has(code)) errors.push(`Result type ${code} is missing.`);
  }
  for (const t of types) if (!t.name?.trim()) errors.push(`Result type ${t.code} has no name.`);
  const noDesign = types.filter(t => !t.design_image_id).length;
  if (noDesign) warnings.push(`${noDesign} result type${noDesign === 1 ? ' has' : 's have'} no Pawsonalities design linked yet.`);

  return { errors, warnings };
}

export const STATEMENT_MAX = 200;
export const TEXT_MAX = 300;

/** Trim and length-check a text field from an admin form; null when empty. */
export function cleanText(v: unknown, max = TEXT_MAX): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s ? s.slice(0, max) : null;
}
