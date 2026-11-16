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

/** Birthday and zodiac campaigns, and the lines for people who have bought (same voice: playful British English, no promises, no discount, no emoji) */
export const CAMPAIGN_EMAIL = {
  birthday: {
    subject: (firstName: string | null) => (firstName ? `${firstName}'s birthday is coming: Pawcasso got in early` : 'A birthday Pawtrait, painted early'),
    heading: (firstName: string | null) => (firstName ? `A birthday Pawtrait for ${firstName}` : 'A birthday surprise from Pawcasso'),
    preheader: 'A few party-ready paintings, a little ahead of the big day.',
    intro: (firstName: string | null) => `${firstName ?? 'Your pet'}'s big day is coming up, so Pawcasso got in early with a few party-ready paintings.`,
  },
  zodiac: {
    subject: (firstName: string | null, sign: string) => (firstName ? `${sign} season is coming, and ${firstName} is ready` : `${sign} season is coming`),
    heading: (firstName: string | null, sign: string) => (firstName ? `${sign} season, painted for ${firstName}` : `${sign} season is nearly here`),
    preheader: 'Their star sign, painted by Pawcasso.',
    intro: (firstName: string | null, sign: string) => `${firstName ?? 'Your pet'} is a ${sign}, so Pawcasso painted a star-sign card to celebrate, with a couple of favourites alongside.`,
  },
  /** Why they are getting it: someone who has bought from us (the previewer line is OFFER_EMAIL.why) */
  whyBuyer: (firstName: string | null) => `You bought a Pawtrait from us, and we said we would keep ${firstName ? `${firstName}'s` : 'your pet\'s'} photo so Pawcasso could paint them again.`,
  /** "When's Biscuit's birthday? Tell us and Pawcasso will paint something for the big day." (the middle part is the link) */
  askBirthday: (firstName: string | null) => ({
    lead: `When's ${firstName ?? 'your pet'}'s birthday?`, link: 'Tell us', tail: 'and Pawcasso will paint something for the big day.',
  }),
  photoOptOut: 'Please don\'t reuse my photo',
} as const;

/** The birthday page (the link in an offer email) */
export const BIRTHDAY_PAGE = {
  title: 'Their birthday | Pawtraits',
  heading: (firstName: string | null) => `When's ${firstName ?? 'your pet'}'s birthday?`,
  intro: 'Tell us and Pawcasso will paint something special for the big day.',
  save: 'Save',
  yearHint: 'Year (optional)',
  thanks: 'Thank you. Pawcasso has made a note.',
  tryAgain: 'That date does not look quite right. Please have another go.',
} as const;

/** The one-off notice to past buyers (lib/offers/notice.ts, template customer-photo-notice.html): we have kept the photo, and what Pawcasso may do with it */
export const NOTICE_EMAIL = {
  subject: (firstName: string | null) => (firstName ? `Pawcasso would love to paint ${firstName} again` : 'Pawcasso would love to paint your pet again'),
  heading: (firstName: string | null) => (firstName ? `Pawcasso hasn't forgotten ${firstName}` : 'Pawcasso hasn\'t forgotten your pet'),
  preheader: 'A quick note about the photo you sent us.',
  lines: (firstName: string | null) => [
    `We've kept the photo you sent us of ${firstName ?? 'your pet'}.`,
    `From time to time Pawcasso will paint ${firstName ?? 'them'} into something new, like a birthday surprise, their star sign or the odd seasonal treat, and email it to you.`,
    'Nothing to do if that sounds fun.',
  ],
  optOut: 'Please don\'t reuse my photo',
  why: 'You\'re getting this once, because you bought a Pawtrait from pawtraits.pics.',
  testSubjectPrefix: '[Test] ',
} as const;
