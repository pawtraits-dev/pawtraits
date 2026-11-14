/** Words for "Email me this preview" (client-safe): the card on the preview page, and the email lines. */
export const PREVIEW_COPY = {
  heading: 'Not ready to decide?',
  line: 'We\'ll email you this preview so you can pick it up later, on any device.',
  fieldLabel: 'Your email',
  placeholder: 'you@example.com',
  button: 'Email me this preview',
  sending: 'Sending…',
  sentHeading: 'It\'s on its way',
  sentLine: (masked: string) => `We've sent your preview to ${masked}. Open it on any device to carry on.`,
  again: 'Send it again',
  different: 'Use a different address',
  signedInSent: (masked: string) => `Sent to ${masked}.`,
  errBad: 'That doesn\'t look like an email address.',
  errLimit: 'That\'s a lot of emails for one preview. Give your inbox a moment, then try again.',
  errOther: 'Something went wrong sending that. Please try again in a minute.',
  errUnavailable: 'Emailing previews isn\'t available just yet. Please try again soon.',
} as const;

/** The email itself */
export const PREVIEW_EMAIL = {
  heading: 'Here\'s your preview',
  preheader: 'Pick up where you left off, on any device.',
  button: 'See my preview',
  marketingLine: 'You also said yes to new designs and the odd offer. We\'ll start once you\'ve opened your preview; if that wasn\'t you, do nothing and you won\'t hear from us again.',
  footerNote: 'You\'re getting this because someone asked for this preview to be sent here from pawtraits.pics. If that wasn\'t you, you can ignore it.',
  subject: (firstName: string | null) => (firstName ? `${firstName}'s Pawtrait preview is ready` : 'Your Pawtrait preview is ready'),
  body: (firstName: string | null) => `Pawcasso has painted ${firstName ?? 'your pet'} in. Have another look, pick a size, and it's yours.`,
} as const;
