/**
 * Keeps the admin operating manual honest (lib/admin/manual/content.ts).
 * Run: npx tsx scripts/test-admin-manual.ts
 *
 *  - every link points at a real admin page, and is one of the pages in REFERENCED_PAGES
 *  - REFERENCED_PAGES names and hrefs match the sidebar in app/admin/layout.tsx
 *  - task keys are unique slugs; every routine has tasks; weekly tasks have a due day
 *  - no prices are written in (no pound sign followed by a digit)
 *  - every **bold label** appears in the admin source (buttons, tabs, headings), so labels cannot drift
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GLOSSARY, GUIDES, REFERENCED_PAGES, ROUTINES, TROUBLESHOOTING,
} from '../lib/admin/manual/content';

const ROOT = path.resolve(__dirname, '..');
let checks = 0;
const ok = (cond: unknown, msg: string) => { checks++; assert.ok(cond, msg); };

function walk(dir: string, test: (f: string) => boolean, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, test, out);
    else if (test(full)) out.push(full);
  }
  return out;
}

// ---- admin routes that exist
const adminRoot = path.join(ROOT, 'app', 'admin');
const routePatterns = walk(adminRoot, f => path.basename(f) === 'page.tsx').map(f => {
  const rel = path.relative(path.join(ROOT, 'app'), path.dirname(f)).split(path.sep).join('/');
  return '/' + rel;
});
const routeExists = (href: string) => routePatterns.some(p => {
  const a = p.split('/'), b = href.split('/');
  return a.length === b.length && a.every((seg, i) => (seg.startsWith('[') && seg.endsWith(']') ? b[i] !== '' : seg === b[i]));
});

const layout = fs.readFileSync(path.join(adminRoot, 'layout.tsx'), 'utf8');

// ---- every piece of text in the manual
const texts: string[] = [];
const links: { where: string; label: string; href: string }[] = [];
ROUTINES.forEach(r => {
  texts.push(r.title, r.summary, r.when);
  r.tasks.forEach(t => {
    texts.push(t.title, t.why, ...t.steps);
    links.push({ where: `task ${t.key}`, ...t.link });
  });
});
GUIDES.forEach(g => {
  texts.push(g.title, g.summary);
  g.sections.forEach(s => {
    texts.push(s.heading, ...s.body);
    (s.links ?? []).forEach(l => links.push({ where: `guide ${g.slug} / ${s.heading}`, ...l }));
  });
});
GLOSSARY.forEach(g => texts.push(g.term, g.meaning));
TROUBLESHOOTING.forEach(t => {
  texts.push(t.problem, ...t.fix, t.who);
  if (t.link) links.push({ where: `troubleshooting ${t.problem}`, ...t.link });
});

// ---- links
links.forEach(l => {
  ok(l.href.startsWith('/admin'), `${l.where}: link ${l.href} must start with /admin`);
  ok(!l.href.includes('?') && !l.href.includes('#'), `${l.where}: keep links free of query strings`);
  ok(routeExists(l.href), `${l.where}: no admin page at ${l.href}`);
  const ref = REFERENCED_PAGES.find(p => p.href === l.href);
  ok(ref, `${l.where}: ${l.href} is not in REFERENCED_PAGES`);
  ok(ref && ref.label === l.label, `${l.where}: link label "${l.label}" should be "${ref?.label}"`);
});

// ---- referenced pages against the sidebar
REFERENCED_PAGES.forEach(p => {
  ok(routeExists(p.href), `page ${p.href} does not exist`);
  const inLayout = layout.includes(`name: '${p.label}', href: '${p.href}'`);
  ok(inLayout, `sidebar in app/admin/layout.tsx has no "${p.label}" -> ${p.href}`);
});

// ---- task keys and routines
const keys = new Set<string>();
ROUTINES.forEach(r => {
  ok(r.tasks.length > 0, `routine ${r.id} has no tasks`);
  r.tasks.forEach(t => {
    ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.key), `task key "${t.key}" is not a slug`);
    ok(!keys.has(t.key), `task key "${t.key}" is used twice`);
    keys.add(t.key);
    ok(t.steps.length > 0 && t.title && t.why, `task ${t.key} needs a title, a reason and steps`);
    ok(t.minutes > 0, `task ${t.key} needs minutes`);
    ok(t.role === 'owner' || t.role === 'anyone', `task ${t.key} has a bad role`);
    if (r.id === 'weekly') ok(Number.isInteger(t.dueDay) && t.dueDay! >= 1 && t.dueDay! <= 7, `weekly task ${t.key} needs dueDay 1-7`);
  });
});
const slugs = new Set<string>();
GUIDES.forEach(g => {
  ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug) && !slugs.has(g.slug), `guide slug "${g.slug}" is bad or repeated`);
  slugs.add(g.slug);
  ok(g.sections.length > 0, `guide ${g.slug} has no sections`);
});

// ---- no prices, no partner programme, no delivery promises
texts.forEach(t => {
  ok(!/£\s*\d/.test(t), `price written in: ${t.slice(0, 80)}`);
  ok(!/partner (programme|program)/i.test(t), `partner programme mentioned: ${t.slice(0, 80)}`);
  ok(!/money[- ]back|within \d+ (working |business )?days|next[- ]day delivery/i.test(t), `delivery or refund promise: ${t.slice(0, 80)}`);
  ok(!/\*\*[^*]*$/.test(t.replace(/\*\*[^*]*\*\*/g, '')), `unbalanced ** in: ${t.slice(0, 80)}`);
});

// ---- bold labels exist in the admin source
const normalise = (s: string) => s.replace(/&amp;/g, '&').replace(/&apos;|&#39;/g, "'").replace(/&rsquo;/g, '’').replace(/&ldquo;|&rdquo;/g, '"');
const sourceFiles = [
  ...walk(adminRoot, f => /\.(tsx|ts)$/.test(f)),
  ...walk(path.join(ROOT, 'components', 'admin'), f => /\.(tsx|ts)$/.test(f)),
  path.join(ROOT, 'lib', 'fulfillment', 'shared.ts'),
  path.join(ROOT, 'lib', 'admin', 'dashboard.ts'),
];
const corpus = sourceFiles.map(f => normalise(fs.readFileSync(f, 'utf8'))).join('\n');
const labels = new Set<string>();
texts.forEach(t => { (t.match(/\*\*([^*]+)\*\*/g) ?? []).forEach(m => labels.add(m.slice(2, -2))); });
const missing: string[] = [];
Array.from(labels).forEach(label => {
  const bare = label.replace(/[….]+$/, '').replace(/ →$/, '');
  checks++;
  if (!corpus.includes(bare)) missing.push(label);
});
assert.deepEqual(missing, [], `bold labels not found in the admin source: ${missing.join(' | ')}`);

console.log(`admin manual: ${checks} checks passed (${keys.size} tasks, ${GUIDES.length} guides, ${labels.size} labels, ${links.length} links)`);
