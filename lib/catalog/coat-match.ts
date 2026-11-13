/**
 * Closest coat colour: when there is no design in a pet's exact coat, recommend the
 * nearest colour we do have (an Apricot pet sees Golden, not Black).
 */
export interface CoatColour { id: string; hex_color?: string | null }

function rgb(hex?: string | null): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Perceptually weighted distance between two colours ("redmean"); lower is closer */
export function colourDistance(a?: string | null, b?: string | null): number | null {
  const x = rgb(a); const y = rgb(b);
  if (!x || !y) return null;
  const rMean = (x[0] + y[0]) / 2;
  const dr = x[0] - y[0]; const dg = x[1] - y[1]; const db = x[2] - y[2];
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

/** The candidate whose colour is nearest to the target, or null if colours are unknown */
export function closestCoat(target: CoatColour | null | undefined, candidates: CoatColour[]): CoatColour | null {
  if (!target?.hex_color) return null;
  let best: CoatColour | null = null;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const d = colourDistance(target.hex_color, c.hex_color);
    if (d !== null && d < bestDistance) { best = c; bestDistance = d; }
  }
  return best;
}
