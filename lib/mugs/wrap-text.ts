/**
 * The words on the text side of a mug wrap (pure, no network).
 *
 * The whole catalogue description is printed, not a cut-down snippet. A last paragraph written
 * wholly in emphasis (`*Life is never boring with an Aries dog in charge*` or `**…**`) is a
 * tagline: it is printed on its own line, in bold, under the body. The body's font size steps down
 * until body + tagline fit the right-hand panel; only if they still do not fit at the smallest size
 * is the body shortened (with an ellipsis), so nothing runs off the mug.
 */
import { plainText, snippet } from '@/lib/text/plain';

export interface MugWrapText {
  body: string;
  tagline: string | null;
  fontSize: number;
}

/** Font sizes tried for the body (px on the 2362 × 1134 canvas), largest first */
export const MUG_BODY_SIZES = [38, 36, 34, 32, 30] as const;
/** Characters per line at 38 px in the 1000 px wide text box (about 52 on the printed wraps; 48 errs towards more lines, so the closing line never overlaps the body) */
const CHARS_PER_LINE_AT_38 = 48;
/** Room for body + tagline: canvas height, less a 60 px margin top and bottom, less the heading and sub-heading (300 px) */
export const MUG_TEXT_ROOM = 1134 - 2 * 60 - 300;
const LINE_HEIGHT = 1.35;

const EMPHASIS = /^(\*\*|\*|__|_)([\s\S]+?)\1$/;

/** Splits a markdown description into body and an emphasised closing line, if there is one */
export function splitTagline(description?: string | null): { body: string; tagline: string | null } {
  const paras = (description || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (!paras.length) return { body: '', tagline: null };
  const last = paras[paras.length - 1];
  const m = paras.length > 1 || paras[0].split(/\n/).length > 1 ? last.match(EMPHASIS) : null;
  if (m) return { body: plainText(paras.slice(0, -1).join(' ')), tagline: plainText(m[2]) || null };
  // A single block whose last line is emphasised ("…chaos.\n*Life is never boring…*")
  const lines = last.split(/\n/).map(l => l.trim()).filter(Boolean);
  const lastLine = lines.length > 1 ? lines[lines.length - 1].match(EMPHASIS) : null;
  if (lastLine) {
    return { body: plainText([...paras.slice(0, -1), lines.slice(0, -1).join(' ')].join(' ')), tagline: plainText(lastLine[2]) || null };
  }
  return { body: plainText(paras.join(' ')), tagline: null };
}

/** Estimated number of lines for text at a font size in the description box */
export function estimateLines(text: string, fontSize: number): number {
  if (!text) return 0;
  const perLine = Math.max(10, Math.floor(CHARS_PER_LINE_AT_38 * 38 / fontSize));
  return Math.max(1, Math.ceil(text.length / perLine));
}

/** Height (px) of body + gap + tagline at a font size */
export function textBlockHeight(body: string, tagline: string | null, fontSize: number): number {
  const lh = Math.round(fontSize * LINE_HEIGHT);
  const bodyH = estimateLines(body, fontSize) * lh;
  const tagH = tagline ? Math.round(fontSize * 0.8) + estimateLines(tagline, fontSize) * lh : 0;
  return bodyH + tagH;
}

/**
 * The text for the wrap. Uses the full description; falls back to the short description when the
 * full one is empty.
 */
export function mugWrapText(description?: string | null, descriptionShort?: string | null): MugWrapText {
  let { body, tagline } = splitTagline(description);
  if (!body && !tagline) body = plainText(descriptionShort);
  for (const size of MUG_BODY_SIZES) {
    if (textBlockHeight(body, tagline, size) <= MUG_TEXT_ROOM) return { body, tagline, fontSize: size };
  }
  // Still too long at the smallest size: shorten the body to what fits, keep the tagline whole
  const size = MUG_BODY_SIZES[MUG_BODY_SIZES.length - 1];
  const lh = Math.round(size * LINE_HEIGHT);
  const tagH = tagline ? Math.round(size * 0.8) + estimateLines(tagline, size) * lh : 0;
  const lines = Math.max(1, Math.floor((MUG_TEXT_ROOM - tagH) / lh));
  const perLine = Math.floor(CHARS_PER_LINE_AT_38 * 38 / size);
  return { body: snippet(body, lines * perLine - 2), tagline, fontSize: size };
}
