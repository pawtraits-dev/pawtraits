/**
 * The words on the text side of a mug wrap (pure, no network).
 *
 * The whole catalogue description is printed, not a cut-down snippet. A first line written wholly
 * in emphasis (`**The Pisces dog feels everything**`) is printed bold on its own line above the body;
 * a last line written wholly in emphasis (`*Life is never boring with an Aries dog in charge*`) is
 * printed bold, in the mug's highlight colour, on its own line under the body. The body's font size steps down
 * until body + tagline fit the right-hand panel; only if they still do not fit at the smallest size
 * is the body shortened (with an ellipsis), so nothing runs off the mug.
 */
import { plainText, snippet } from '@/lib/text/plain';

export interface MugWrapText {
  /** An emphasised opening line (`**The Pisces dog feels everything**`), printed bold on its own line */
  lead: string | null;
  body: string;
  /** An emphasised closing line, printed bold in the mug's highlight colour */
  tagline: string | null;
  fontSize: number;
}

/** Font sizes tried for the body (px on the 2362 × 1134 canvas), largest first */
export const MUG_BODY_SIZES = [38, 36, 34, 32, 30] as const;
/** Characters per line at 38 px in the 1000 px wide text box (about 52 on the printed wraps; 48 errs towards more lines, so the lines never overlap) */
const CHARS_PER_LINE_AT_38 = 48;
/** Room for lead + body + tagline: canvas height, less a 60 px margin top and bottom, less the heading and sub-heading (300 px) */
export const MUG_TEXT_ROOM = 1134 - 2 * 60 - 300;
const LINE_HEIGHT = 1.35;
/** Space between the lead, the body and the closing line, as a fraction of the font size */
export const MUG_PART_GAP = 0.8;

const EMPHASIS = /^(\*\*|\*|__|_)([\s\S]+?)\1$/;
const emphasised = (line: string) => { const m = line.trim().match(EMPHASIS); return m ? m[2].trim() : null; };

/**
 * Splits a markdown description into an emphasised opening line, the body, and an emphasised closing
 * line. "Emphasised" means the whole line is wrapped in *…*, **…**, _…_ or __…__. Emphasis inside a
 * sentence can't be printed in a different weight, so it is printed plain.
 */
export function splitDescription(description?: string | null): { lead: string | null; body: string; tagline: string | null } {
  const lines = (description || '').split(/\r?\n/).map(l => l.trim());
  const content = lines.filter(Boolean);
  if (!content.length) return { lead: null, body: '', tagline: null };
  let first = 0, last = content.length - 1;
  let lead: string | null = null, tagline: string | null = null;
  if (content.length > 1) {
    const close = emphasised(content[last]);
    if (close) { tagline = plainText(close) || null; last--; }
  }
  if (last > first) {
    const open = emphasised(content[first]);
    if (open) { lead = plainText(open) || null; first++; }
  }
  const body = plainText(content.slice(first, last + 1).join(' '));
  return { lead, body, tagline };
}

/** @deprecated kept for callers that only need body + closing line */
export function splitTagline(description?: string | null): { body: string; tagline: string | null } {
  const { lead, body, tagline } = splitDescription(description);
  return { body: [lead, body].filter(Boolean).join(' '), tagline };
}

/** Estimated number of lines for text at a font size in the description box */
export function estimateLines(text: string, fontSize: number): number {
  if (!text) return 0;
  const perLine = Math.max(10, Math.floor(CHARS_PER_LINE_AT_38 * 38 / fontSize));
  return Math.max(1, Math.ceil(text.length / perLine));
}

/** Height (px) of each part and the whole block at a font size */
export function textBlockLayout(t: { lead: string | null; body: string; tagline: string | null }, fontSize: number) {
  const lh = Math.round(fontSize * LINE_HEIGHT);
  const gap = Math.round(fontSize * MUG_PART_GAP);
  const parts = [t.lead, t.body, t.tagline].map(x => (x ? estimateLines(x, fontSize) * lh : 0));
  const present = parts.filter(h => h > 0).length;
  const total = parts.reduce((a, b) => a + b, 0) + Math.max(0, present - 1) * gap;
  return { leadH: parts[0], bodyH: parts[1], taglineH: parts[2], gap, total };
}

/** Height (px) of the whole text block (kept for existing callers) */
export function textBlockHeight(body: string, tagline: string | null, fontSize: number, lead: string | null = null): number {
  return textBlockLayout({ lead, body, tagline }, fontSize).total;
}

/** The text for the wrap. Uses the full description; falls back to the short description when the full one is empty. */
export function mugWrapText(description?: string | null, descriptionShort?: string | null): MugWrapText {
  let { lead, body, tagline } = splitDescription(description);
  if (!lead && !body && !tagline) body = plainText(descriptionShort);
  for (const size of MUG_BODY_SIZES) {
    if (textBlockLayout({ lead, body, tagline }, size).total <= MUG_TEXT_ROOM) return { lead, body, tagline, fontSize: size };
  }
  // Still too long at the smallest size: shorten the body to what fits; keep the opening and closing lines whole
  const size = MUG_BODY_SIZES[MUG_BODY_SIZES.length - 1];
  const fixed = textBlockLayout({ lead, body: '', tagline }, size);
  const lh = Math.round(size * LINE_HEIGHT);
  const lines = Math.max(1, Math.floor((MUG_TEXT_ROOM - fixed.total - fixed.gap) / lh));
  const perLine = Math.floor(CHARS_PER_LINE_AT_38 * 38 / size);
  return { lead, body: snippet(body, lines * perLine - 2), tagline, fontSize: size };
}
