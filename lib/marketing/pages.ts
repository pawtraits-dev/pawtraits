/**
 * Small server-rendered HTML pages for the unsubscribe link (no JavaScript, so a mail client or a
 * link scanner can open them): the "Stop all emails?" confirm page and its done page.
 * Everything dynamic is escaped.
 */
import { PREFS_COPY } from './consent-copy';

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
