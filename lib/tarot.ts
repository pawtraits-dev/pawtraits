/**
 * The 22 Major Arcana: the tarot collection's cards (lib/collections/definitions.ts), their order
 * and the Roman numeral that goes in the frame's medallion. Client-safe; the same list is seeded
 * by db/migrations/2026-11-13-framed-cards.sql.
 */
export interface TarotCard { slug: string; name: string; numeral: string; number: number }

export const TAROT: TarotCard[] = [
  { slug: 'the-fool', name: 'The Fool', numeral: '0', number: 0 },
  { slug: 'the-magician', name: 'The Magician', numeral: 'I', number: 1 },
  { slug: 'the-high-priestess', name: 'The High Priestess', numeral: 'II', number: 2 },
  { slug: 'the-empress', name: 'The Empress', numeral: 'III', number: 3 },
  { slug: 'the-emperor', name: 'The Emperor', numeral: 'IV', number: 4 },
  { slug: 'the-hierophant', name: 'The Hierophant', numeral: 'V', number: 5 },
  { slug: 'the-lovers', name: 'The Lovers', numeral: 'VI', number: 6 },
  { slug: 'the-chariot', name: 'The Chariot', numeral: 'VII', number: 7 },
  { slug: 'strength', name: 'Strength', numeral: 'VIII', number: 8 },
  { slug: 'the-hermit', name: 'The Hermit', numeral: 'IX', number: 9 },
  { slug: 'wheel-of-fortune', name: 'Wheel of Fortune', numeral: 'X', number: 10 },
  { slug: 'justice', name: 'Justice', numeral: 'XI', number: 11 },
  { slug: 'the-hanged-man', name: 'The Hanged Man', numeral: 'XII', number: 12 },
  { slug: 'death', name: 'Death', numeral: 'XIII', number: 13 },
  { slug: 'temperance', name: 'Temperance', numeral: 'XIV', number: 14 },
  { slug: 'the-devil', name: 'The Devil', numeral: 'XV', number: 15 },
  { slug: 'the-tower', name: 'The Tower', numeral: 'XVI', number: 16 },
  { slug: 'the-star', name: 'The Star', numeral: 'XVII', number: 17 },
  { slug: 'the-moon', name: 'The Moon', numeral: 'XVIII', number: 18 },
  { slug: 'the-sun', name: 'The Sun', numeral: 'XIX', number: 19 },
  { slug: 'judgement', name: 'Judgement', numeral: 'XX', number: 20 },
  { slug: 'the-world', name: 'The World', numeral: 'XXI', number: 21 },
];
