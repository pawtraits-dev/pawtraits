/**
 * Short plain text for banners, cards and alt text (client-safe).
 * Strips markdown markers and cuts at a word boundary with an ellipsis, so we never
 * show "**Athletic enthusiasts … professional sp".
 */
export function plainText(text?: string | null): string {
  return (text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function snippet(text?: string | null, max = 120): string {
  const plain = plainText(text);
  const looksCut = plain.length > 0 && !/[.!?…)"'’”]$/.test(plain);
  if (plain.length <= max && !looksCut) return plain;
  const cut = plain.slice(0, Math.min(max, plain.length));
  const lastSpace = cut.lastIndexOf(' ');
  const base = (plain.length > max || looksCut) && lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[,;:\s–—-]+$/, '') + '…';
}

/** First line / bold title of a catalogue description, as plain text */
export function designTitle(description?: string | null, fallback = 'Pet Pawtrait'): string {
  const d = description || '';
  const bold = d.match(/\*\*(.+?)\*\*/);
  const first = bold ? bold[1] : d.split('\n').find(l => l.trim()) || '';
  return plainText(first) || fallback;
}
