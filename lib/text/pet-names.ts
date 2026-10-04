/**
 * Pet names for a design with several pets (multi-pet plan phase 1):
 * ["Biscuit", "Luna"] → "Biscuit & Luna"; ["A", "B", "C"] → "A, B & C".
 * Placeholder names ("Uploaded Pet", blanks) are left out; none left → fallback.
 */
const PLACEHOLDERS = new Set(['uploaded pet', 'pet', '']);

export function joinPetNames(names: (string | null | undefined)[], fallback = 'Uploaded Pet'): string {
  const real = names.map(n => (n ?? '').trim()).filter(n => !PLACEHOLDERS.has(n.toLowerCase()));
  if (!real.length) return fallback;
  return real.length === 1 ? real[0] : `${real.slice(0, -1).join(', ')} & ${real[real.length - 1]}`;
}
