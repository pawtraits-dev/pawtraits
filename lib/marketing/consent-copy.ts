/**
 * The ONE place the marketing opt-in wording lives (client-safe). The tick box, the preferences
 * page, and the evidence stored with each consent (email_preferences.consent_wording / _version)
 * all come from here. Change the words → bump CONSENT_VERSION.
 */
export const CONSENT_VERSION = '2026-11';

/** The tick-box label (never pre-ticked) */
export const CONSENT_LABEL = 'Yes please: send me new designs, a birthday treat for my pet and the odd offer. Stop any time.';

/** Checkout (people buying from us): a line of text and an UNTICKED opt-out box. Not ticking = subscribed once the order is paid. */
export const CHECKOUT_LINE = 'We\'ll send you new designs, a birthday treat for your pet and the odd offer. Stop any time.';
export const CHECKOUT_OPT_OUT_LABEL = 'No thanks, just my order emails';
/** What is stored as the wording for a checkout subscription: both strings the buyer saw */
export const CHECKOUT_WORDING = `${CHECKOUT_LINE} [ ] ${CHECKOUT_OPT_OUT_LABEL}`;

/** 'soft_opt_in': bought from us and did not say no. 'consent': ticked yes / said yes on the preferences page. */
export type ConsentBasis = 'soft_opt_in' | 'consent';
export const BASIS_WORDS: Record<ConsentBasis, string> = { soft_opt_in: 'Bought from us (didn\'t say no)', consent: 'Ticked yes' };

export type EmailTopic = 'new_designs' | 'pet_days' | 'offers';

export const EMAIL_TOPICS: { key: EmailTopic; title: string; description: string }[] = [
  { key: 'new_designs', title: 'Fresh off the easel', description: 'New designs for your pet\'s breed, as Pawcasso paints them.' },
  { key: 'pet_days', title: 'Birthday and star-sign treats', description: 'A little something when it\'s your pet\'s big day.' },
  { key: 'offers', title: 'Offers and news', description: 'The odd treat, and what we\'ve been up to.' },
];

export const TOPIC_KEYS: EmailTopic[] = EMAIL_TOPICS.map(t => t.key);
export type EmailTopics = Record<EmailTopic, boolean>;

/** Where a person agreed (stored as consent_source) */
export type ConsentSource = 'checkout' | 'quiz_save' | 'preview_email' | 'preferences_page' | 'account' | 'checkout_legacy';
/** How a person stopped (stored as unsubscribe_source) */
export type UnsubscribeSource = 'email_link' | 'one_click' | 'preferences_page' | 'account' | 'admin';

/** Words for the preferences page and the unsubscribe pages */
export const PREFS_COPY = {
  title: 'Email preferences | Pawtraits',
  heading: 'What lands in your inbox',
  intro: 'You\'re the boss. Pick what you\'d like to hear about, or tell us to sit and stay quiet.',
  note: 'Order updates and receipts still arrive, because you\'ll want those.',
  save: 'Save my choices',
  stopAll: 'Stop all emails',
  saved: 'Saved. Good choices.',
  stopped: 'Done. We\'ll sit and stay quiet.',
  changedMind: 'Changed your mind? Pick what you\'d like instead',
  notYetIntro: 'Nothing is switched on yet. Fancy new designs, a birthday treat for your pet and the odd offer?',
  yesPlease: 'Yes please',
  confirmHeading: 'Stop all emails?',
  confirmBody: 'No hard feelings. You\'ll still get order updates and receipts.',
  confirmButton: 'Yes, stop all emails',
  pickAndChoose: 'I\'d rather pick and choose',
  badHeading: 'This link has gone walkies',
  badBody: 'It may be old or incomplete. Open the link in any of our emails, or drop us a line at support@pawtraits.pics.',
} as const;
