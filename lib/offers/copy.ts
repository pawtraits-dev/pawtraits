/** Words for the offer email (client-safe). Same voice as lib/previews/copy.ts: playful British English, no promises, no discount. */
export const OFFER_EMAIL = {
  heading: (firstName: string | null) => (firstName ? `Pawcasso painted more of ${firstName}` : 'Pawcasso painted a few more'),
  preheader: 'A few more designs, painted from the photo you sent.',
  intro: (firstName: string | null) => `Pawcasso had another go with ${firstName ?? 'your pet'}'s photo. Here are a few more.`,
  button: 'See it bigger',
  /** "Prints from £15." (price comes from the catalogue; null = the line is left out) */
  priceLine: (from: string | null) => (from ? `Prints from ${from}.` : null),
  /** Why they are getting this */
  why: (firstName: string | null) => `You asked us to email a preview of ${firstName ?? 'your pet'} and said yes to the occasional treat.`,
  /** Subject: the number matches the pictures included */
  subject: (firstName: string | null, pictures: number) => {
    const n = pictures === 2 ? '2' : '3';
    return firstName ? `Pawcasso couldn't resist: ${n} more of ${firstName}` : `Pawcasso couldn't resist: ${n} more Pawtraits of your pet`;
  },
} as const;
