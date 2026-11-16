/**
 * Small server-rendered HTML pages for the unsubscribe link (no JavaScript, so a mail client or a
 * link scanner can open them): the "Stop all emails?" confirm page and its done page.
 * Everything dynamic is escaped.
 */
import { PHOTO_PAGE, PREFS_COPY } from './consent-copy';

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#ffffff;color:#111827;font-family:Arial,Helvetica,sans-serif;"><main style="max-width:420px;margin:0 auto;padding:48px 20px;">
<p style="margin:0 0 24px;font-weight:bold;font-size:22px;color:#7e22ce;">Pawtraits</p>${body}</main></body></html>`;
}

const button = 'display:block;width:100%;box-sizing:border-box;height:56px;border:0;border-radius:12px;background:#9333ea;color:#fff;font-size:18px;font-weight:bold;cursor:pointer;';
const link = 'display:block;margin-top:14px;text-align:center;color:#6b21a8;font-weight:bold;text-decoration:none;padding:12px;';

/** GET on the unsubscribe link: nothing happens until the button (a POST) is pressed */
export function confirmPage(postUrl: string, preferencesLink: string): string {
  return shell(PREFS_COPY.confirmHeading, `<h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">${escapeHtml(PREFS_COPY.confirmHeading)}</h1>
<p style="color:#374151;line-height:1.5;">${escapeHtml(PREFS_COPY.confirmBody)}</p>
<form method="post" action="${escapeHtml(postUrl)}" style="margin-top:24px;"><button type="submit" style="${button}">${escapeHtml(PREFS_COPY.confirmButton)}</button></form>
<a href="${escapeHtml(preferencesLink)}" style="${link}">${escapeHtml(PREFS_COPY.pickAndChoose)}</a>`);
}

export function donePage(preferencesLink: string): string {
  return shell(PREFS_COPY.stopped, `<h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">${escapeHtml(PREFS_COPY.stopped)}</h1>
<a href="${escapeHtml(preferencesLink)}" style="${link}">${escapeHtml(PREFS_COPY.changedMind)}</a>`);
}

export function badLinkPage(opts: { browseUrl?: string } = {}): string {
  return shell(PREFS_COPY.badHeading, `<h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">${escapeHtml(PREFS_COPY.badHeading)}</h1>
<p style="color:#374151;line-height:1.5;">${escapeHtml(PREFS_COPY.badBody)}</p>${opts.browseUrl ? `
<a href="${escapeHtml(opts.browseUrl)}" style="${button.replace('display:block;', 'display:block;line-height:56px;text-align:center;text-decoration:none;')}">Browse designs</a>` : ''}`);
}

// ---------------------------------------------------------------------------------------------
// "Please don't reuse my photo" (one click from a notice or offer email; GET only shows this page, the button POSTs)

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function photoConfirmPage(postUrl: string, preferencesLink: string): string {
  return shell(PHOTO_PAGE.confirmHeading, `<h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">${escapeHtml(PHOTO_PAGE.confirmHeading)}</h1>
<p style="color:#374151;line-height:1.5;">${escapeHtml(PHOTO_PAGE.confirmBody)}</p>
<form method="post" action="${escapeHtml(postUrl)}" style="margin-top:24px;"><button type="submit" style="${button}">${escapeHtml(PHOTO_PAGE.confirmButton)}</button></form>
<a href="${escapeHtml(preferencesLink)}" style="${link}">${escapeHtml(PHOTO_PAGE.pickAndChoose)}</a>`);
}

export function photoDonePage(preferencesLink: string): string {
  return shell(PHOTO_PAGE.done, `<h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">${escapeHtml(PHOTO_PAGE.done)}</h1>
<p style="color:#374151;line-height:1.5;">${escapeHtml(PHOTO_PAGE.doneBody)}</p>
<a href="${escapeHtml(preferencesLink)}" style="${link}">${escapeHtml(PHOTO_PAGE.changedMind)}</a>`);
}

/** The birthday form behind the link in an offer email: day and month (and an optional year). Server-rendered, no JavaScript. */
export function birthdayPage(opts: { postUrl: string; heading: string; intro: string; save: string; yearHint: string; problem?: string | null }): string {
  const select = 'height:48px;border:1px solid #d1d5db;border-radius:10px;font-size:16px;padding:0 8px;background:#fff;';
  const days = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  const months = MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
  return shell(opts.heading, `<h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">${escapeHtml(opts.heading)}</h1>
<p style="color:#374151;line-height:1.5;">${escapeHtml(opts.intro)}</p>${opts.problem ? `<p role="alert" style="color:#b91c1c;line-height:1.5;">${escapeHtml(opts.problem)}</p>` : ''}
<form method="post" action="${escapeHtml(opts.postUrl)}" style="margin-top:20px;">
<div style="display:flex;gap:8px;flex-wrap:wrap;">
<select name="day" aria-label="Day" required style="${select}"><option value="">Day</option>${days}</select>
<select name="month" aria-label="Month" required style="${select}"><option value="">Month</option>${months}</select>
<input name="year" aria-label="${escapeHtml(opts.yearHint)}" placeholder="${escapeHtml(opts.yearHint)}" inputmode="numeric" maxlength="4" style="${select}width:140px;">
</div>
<button type="submit" style="${button}margin-top:20px;">${escapeHtml(opts.save)}</button></form>`);
}

export function birthdayDonePage(message: string): string {
  return shell(message, `<h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">${escapeHtml(message)}</h1>`);
}
