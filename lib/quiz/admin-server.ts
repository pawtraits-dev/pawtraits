/**
 * Server-side input parsing for quiz admin routes.
 */
import { DIMENSIONS, type Dimension, type Pole } from './types';
import { STATEMENT_MAX, cleanText } from './admin';

type Parsed<T> = { value: T } | { error: string };

export interface QuestionInput {
  dimension?: Dimension;
  right_pole?: Pole;
  statement?: string;
  share_quote?: string | null;
  visual_brief?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

/** Validates a question create (all required fields) or update (only what's sent). */
export function parseQuestionInput(body: any, create: boolean): Parsed<QuestionInput> {
  const out: QuestionInput = {};
  if (create || body.dimension !== undefined) {
    if (!(body.dimension in DIMENSIONS)) return { error: 'Choose a dimension' };
    out.dimension = body.dimension;
  }
  if (create || body.right_pole !== undefined) {
    const dim = (out.dimension ?? body.dimension) as Dimension | undefined;
    const poles: readonly string[] = dim ? DIMENSIONS[dim] : ['E', 'I', 'S', 'N', 'T', 'F', 'B', 'C'];
    if (!poles.includes(body.right_pole)) return { error: 'Choose what a right swipe scores (it must belong to the dimension)' };
    out.right_pole = body.right_pole;
  }
  if (create || body.statement !== undefined) {
    const s = cleanText(body.statement, STATEMENT_MAX);
    if (!s || s.length < 5) return { error: 'The statement is required (5–200 characters)' };
    out.statement = s;
  }
  if (body.share_quote !== undefined) out.share_quote = cleanText(body.share_quote);
  if (body.visual_brief !== undefined) out.visual_brief = cleanText(body.visual_brief);
  if (body.is_active !== undefined) out.is_active = Boolean(body.is_active);
  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n) || n < 0 || n > 10000) return { error: 'Invalid order' };
    out.sort_order = n;
  }
  if (create && out.is_active === undefined) out.is_active = true;
  return { value: out };
}

export interface ResultTypeInput {
  name?: string;
  tagline?: string | null;
  traits?: string[];
  signature_move?: string | null;
  owner_reality?: string | null;
  share_quote?: string | null;
  design_image_id?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseResultTypeInput(body: any): Parsed<ResultTypeInput> {
  const out: ResultTypeInput = {};
  if (body.name !== undefined) {
    const n = cleanText(body.name, 60);
    if (!n) return { error: 'The type needs a name' };
    out.name = n;
  }
  for (const k of ['tagline', 'signature_move', 'owner_reality', 'share_quote'] as const) {
    if (body[k] !== undefined) out[k] = cleanText(body[k]);
  }
  if (body.traits !== undefined) {
    if (!Array.isArray(body.traits)) return { error: 'Traits must be a list' };
    out.traits = body.traits.map((t: unknown) => cleanText(t)).filter(Boolean).slice(0, 6) as string[];
  }
  if (body.design_image_id !== undefined) {
    if (body.design_image_id === null || body.design_image_id === '') out.design_image_id = null;
    else if (typeof body.design_image_id === 'string' && UUID_RE.test(body.design_image_id.trim())) out.design_image_id = body.design_image_id.trim();
    else return { error: 'Design must be a catalogue image id' };
  }
  return { value: out };
}
