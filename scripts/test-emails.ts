/**
 * Customer email checks: npm run test:emails
 * Renders every customer email with realistic data (through the same helpers the senders use) and
 * checks wording, links, no leftover {{tags}}, no "undefined", subjects, and the shared layout.
 * Writes the rendered emails to EMAIL_PREVIEW_DIR if set (to look at them in a browser).
 */
import fs from 'fs';
import path from 'path';
import { renderTemplate } from '../lib/messaging/template-engine';
import { renderEmailFile } from '../lib/messaging/render-file';
import { countryName, deliveryFor, deliveryWindow, emailItems, heroImage, petPossessive, describeItem } from '../lib/messaging/order-email';

let failed = 0, passed = 0;
const ok = (name: string, cond: boolean, detail = '') => { if (cond) passed++; else { failed++; console.error(`FAIL ${name} ${detail}`); } };
const T = (f: string) => fs.readFileSync(path.join('lib/messaging/templates', f), 'utf8');
const out = process.env.EMAIL_PREVIEW_DIR;
const SUBJECT = {
  order: '{{#if is_collected}}Your Pawtraits receipt 🐾{{else}}{{#if is_digital_only}}Your Pawtrait download is ready 🎨{{else}}Order confirmed: {{#if pet_possessive}}{{{pet_possessive}}}{{else}}your{{/if}} Pawtrait is being printed 🎨{{/if}}{{/if}}',
};

function common(name: string, html: string, must: string[]) {
  ok(`${name}: no leftover tags`, !/{{|}}/.test(html));
  ok(`${name}: no undefined/null`, !/\bundefined\b|>null</.test(html), (html.match(/.{30}undefined.{30}/) || [''])[0]);
  ok(`${name}: shared layout`, html.includes('Pawtraits</span>') && html.includes('support@pawtraits.pics'));
  ok(`${name}: preheader`, /display:none;max-height:0[^>]*>[^<&]{10,}/.test(html));
  ok(`${name}: no SVG images`, !/<img[^>]+\.svg/.test(html));
  ok(`${name}: no broken unsubscribe page`, !html.includes('/preferences/unsubscribe'));
  for (const m of must) ok(`${name}: contains "${m}"`, html.includes(m));
  if (out) fs.writeFileSync(path.join(out, `${name}.html`), html);
}

// Helpers
const printItem = { image_title: 'Custom Pawtrait of Biscuit · Royal', image_url: 'https://res.cloudinary.com/x/biscuit.jpg', quantity: 1, unit_price: 3500, product_data: { product_type: 'physical_print', size_name: 'Medium', width_cm: 30, height_cm: 45 } };
const stallItem = { image_title: 'The Royal Highness', image_url: 'https://res.cloudinary.com/x/royal.jpg', quantity: 1, unit_price: 3500, product_data: { product_type: 'stall_print', size_code: 'M' } };
const digitalItem = { image_title: 'Custom Pawtrait of Biscuit', image_url: '', quantity: 2, unit_price: 999, is_digital: true, product_data: { product_type: 'digital_download' } };
ok('describe print', describeItem(printItem, { giftEligible: true }) === 'Medium print · 30 × 45 cm · with free digital copy');
ok('describe stall', describeItem(stallItem, { giftEligible: true }) === 'Medium print, taken home · with free digital copy');
ok('describe digital', describeItem(digitalItem, { giftEligible: false }) === 'Digital download · full resolution');
ok('quantity shown', emailItems([digitalItem], false)[0].multiple && emailItems([digitalItem], false)[0].price === '£19.98');
ok('hero skips non-https', heroImage([digitalItem, printItem]).url === 'https://res.cloudinary.com/x/biscuit.jpg');
ok('country GB', countryName('GB') === 'United Kingdom' && countryName('United Kingdom') === 'United Kingdom' && countryName('DE') === 'Germany');
ok('delivery GB', deliveryFor('GB').service === 'Royal Mail Tracked 48' && deliveryFor('United Kingdom').days === '2–3');
ok('delivery DE', deliveryFor('DE').service === 'Royal Mail International Tracked');
ok('pet possessive', petPossessive('Custom Pawtrait of Biscuit · Royal') === 'Biscuit’s' && petPossessive('The Royal Highness') === null);
ok('pet possessive, two pets', petPossessive('Custom Pawtrait of Biscuit & Luna · Royal') === 'Biscuit & Luna’s' && petPossessive('Custom Pawtrait of Bo, Rex & Luna') === 'Bo, Rex & Luna’s');
ok('pet possessive ignores sentences', petPossessive('Custom Pawtrait of the dog and more') === null);
ok('window Thu+2–3', deliveryWindow(new Date('2026-10-01T10:00:00Z'), '2–3 working days') === 'Sat 3 – Mon 5 October', String(deliveryWindow(new Date('2026-10-01T10:00:00Z'), '2–3 working days')));
ok('window month change', deliveryWindow(new Date('2026-10-29T10:00:00Z'), '2-3') === 'Sat 31 October – Mon 2 November', String(deliveryWindow(new Date('2026-10-29T10:00:00Z'), '2-3')));

const base = { base_url: 'https://pawtraits.pics', customer_name: 'Sarah', order_number: 'PW-1759333000-a1b2c3', order_url: 'https://pawtraits.pics/orders/x', downloads_url: 'https://pawtraits.pics/customer/downloads', footer_note: 'Order PW-1759333000-a1b2c3 · You’re getting this because you placed an order with Pawtraits.' };
const orderVars = (items: any[], extra: Record<string, any>) => {
  const hero = heroImage(items);
  return { ...base, items: emailItems(items, true), hero_image_url: hero.url, hero_alt: hero.alt, pet_possessive: petPossessive(hero.alt), shipping_amount: '£5.00', total_amount: '£40.00', delivery_service: deliveryFor('GB').service, delivery_days: deliveryFor('GB').days, shipping_name: 'Sarah Jones', shipping_address_line_1: '12 Acacia Avenue', shipping_city: 'Derby', shipping_postcode: 'DE1 1AA', shipping_country_name: countryName('GB'), preheader: 'Printing now · posted within 2 working days, tracked. Paid £40.00', ...extra };
};

// Order confirmation — online print
let v = orderVars([printItem], { show_delivery: true, gift_locked: true, quiz_url: 'https://pawtraits.pics/quiz/pawsonality?src=order-email', social_opt_out_url: 'https://pawtraits.pics/social/opt-out?o=x&t=y' });
let html = renderTemplate(T('customer-order-confirmation.html'), v);
common('order-print', html, ['Order confirmed, Sarah!', 'Medium print · 30 × 45 cm', 'Royal Mail Tracked 48', 'It arrives 2–3 working days after posting', 'United Kingdom', 'View your order', 'Take the quiz', 'Keep my pet out of it', 'biscuit.jpg', 'one tap unlocks it']);
ok('order-print subject', renderTemplate(SUBJECT.order, v) === 'Order confirmed: Biscuit’s Pawtrait is being printed 🎨', renderTemplate(SUBJECT.order, v));
ok('order-print no stall wording', !html.includes('stall') && !html.includes('download is ready'));

// Stall
v = orderVars([stallItem], { is_collected: true, stall_name: 'Old Spitalfields Market', show_delivery: false, total_amount: '£35.00', gift_available: true, preheader: 'Receipt for your Pawtrait from Old Spitalfields Market. Paid £35.00' });
html = renderTemplate(T('customer-order-confirmation.html'), v);
common('order-stall', html, ['It’s yours, Sarah!', 'at Old Spitalfields Market', 'taken home', 'in My downloads</a>']);
ok('order-stall no delivery', !html.includes('Delivering to') && !html.includes('What happens next') && !html.includes('Delivery'));
ok('order-stall subject', renderTemplate(SUBJECT.order, v) === 'Your Pawtraits receipt 🐾');

// Digital
v = orderVars([digitalItem], { is_digital_only: true, show_delivery: false, total_amount: '£19.98', download_links: [{ title: 'Download portrait 1', url: 'https://pawtraits.pics/api/downloads/1?t=a' }, { title: 'Download portrait 2', url: 'https://pawtraits.pics/api/downloads/2?t=b' }], multiple_downloads: true, preheader: 'Your full-resolution Pawtrait is ready to save. Paid £19.98' });
html = renderTemplate(T('customer-order-confirmation.html'), v);
common('order-digital', html, ['Your download is ready, Sarah!', 'Pawtraits are ready to save', 'Download portrait 1', 'Download portrait 2', '&times;2']);
ok('order-digital no delivery', !html.includes('Delivering to') && !html.includes('What happens next'));
ok('order-digital subject', renderTemplate(SUBJECT.order, v) === 'Your Pawtrait download is ready 🎨');

// Account ready
html = renderTemplate(T('customer-guest-account-ready.html'), { ...base, claim_url: 'https://pawtraits.pics/auth/claim?t=abc', has_gift: true, gift_image_url: 'https://res.cloudinary.com/x/biscuit.jpg', expires_days: 7 });
common('account-ready', html, ['Your free digital copy is waiting', 'Unlock my free download', 'works for 7 days', 'Didn’t place this order?']);
html = renderTemplate(T('customer-guest-account-ready.html'), { ...base, claim_url: 'https://x', has_gift: false, gift_image_url: null, expires_days: 7 });
common('account-ready-nogift', html, ['Your Pawtraits account is ready', 'Open my account']);

// Posted
const shipped = deliveryWindow(new Date('2026-10-01T10:00:00Z'), '2–3 working days');
html = renderTemplate(T('customer-order-shipped.html'), { ...base, shipped_date: 'Thursday 1 October', tracking_number: 'TT123456789GB', tracking_url: 'https://www.royalmail.com/track-your-item#/tracking-results/TT123456789GB', has_tracking: true, carrier_name: 'Royal Mail', shipping_method: 'Tracked 48', estimated_delivery_date: shipped, shipping_city: 'Derby', shipping_postcode: 'DE1 1AA', shipping_country_name: 'United Kingdom', is_self_print: true, hero_image_url: 'https://res.cloudinary.com/x/biscuit.jpg' });
common('posted', html, ['It’s on its way, Sarah!', 'printed, packed by hand and posted', 'Sat 3 – Mon 5 October', 'TT123456789GB', 'Track my parcel', 'Derby DE1 1AA, United Kingdom']);
html = renderTemplate(T('customer-order-shipped.html'), { ...base, shipped_date: 'Thursday 1 October', has_tracking: false, tracking_url: '', carrier_name: 'Royal Mail', shipping_method: '2nd Class', estimated_delivery_date: shipped, shipping_city: 'Derby', shipping_postcode: 'DE1', is_self_print: true });
common('posted-untracked', html, ['View your order']);
ok('posted-untracked no tracking', !html.includes('Tracking number'));

// Sign-in, quiz save (rendered exactly as the routes do)
html = renderEmailFile('customer-sign-in.html', { customer_name: 'Sarah', sign_in_url: 'https://pawtraits.pics/auth/claim?t=abc&login=1' });
common('sign-in', html, ['Your sign-in link', 'Hi Sarah,', 'Sign in to Pawtraits', 'works once, for 1 hour']);
html = renderEmailFile('customer-sign-in.html', { customer_name: '', sign_in_url: 'https://x' });
ok('sign-in no name', html.includes('Hi, tap the button'));
html = renderEmailFile('customer-quiz-save.html', { pet_name: 'Biscuit', type_name: 'The Party Animal', type_code: 'ESFB', picture_url: null, save_url: 'https://x' });
common('quiz-save', html, ['Save Biscuit’s Pawsonality', 'The Party Animal', 'ESFB', 'works for 3 days']);
html = renderEmailFile('customer-quiz-save.html', { pet_name: '<b>Rex</b>', type_name: 'X', save_url: 'https://x' });
ok('quiz-save escapes names', !html.includes('<b>Rex</b>') && html.includes('&lt;b&gt;Rex'));

// Credit earned (no friend's name), on Instagram
html = renderTemplate(T('customer-credit-earned.html'), { ...base, referred_customer_name: 'Tom', credit_amount: '£5.00', total_credit_balance: '£10.00', shop_url: 'https://pawtraits.pics/browse', referrals_url: 'https://pawtraits.pics/customer/referrals' });
common('credit-earned', html, ['You’ve earned £5.00 credit!', '£10.00', 'Use my credit', 'Invite more friends']);
ok('credit-earned hides friend name', !html.includes('Tom'));
html = renderTemplate(T('customer-on-instagram.html'), { base_url: 'https://pawtraits.pics', pet_name: 'Biscuit', picture_url: 'https://res.cloudinary.com/x/b.jpg', post_url: 'https://www.instagram.com/p/ABC/', opt_out_url: 'https://pawtraits.pics/social/opt-out?o=x&t=y' });
common('on-instagram', html, ['Biscuit’s on Instagram!', 'See the post', 'instagram.com/p/ABC', 'Tell us']);

console.log(failed ? `${failed} failed, ${passed} passed` : `${passed} tests passed`);
process.exit(failed ? 1 : 0);
