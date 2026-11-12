/**
 * Fails (exit 1) when an exported handler in any route.ts under app/api/admin has no admin check.
 *
 * A handler passes when its body calls requireAdmin(, or does the inline check
 * (auth.getUser() + user_type === 'admin'), or calls a function declared in the same
 * file that does one of those.
 *
 * Run: npm run test:admin-guards
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const ADMIN_API = path.join(ROOT, 'app', 'api', 'admin');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// One-off routes that the security spec (docs/specs/security-close-open-routes.md,
// Workstream B) deletes. Ignored here while they still exist.
const PENDING_DELETE = new Set(
  [
    'apply-product-schema', 'apply-schema', 'apply-storage-policies', 'check-tables',
    'cleanup-auth', 'cleanup-auth-safe', 'debug-image-urls', 'debug-media',
    'diagnose-gelato-urls', 'fix-gelato-urls', 'migrate-customers', 'migrate-sizes',
    'setup-default-media', 'setup-hero-images-bucket', 'setup-storage-policies',
    'test-hero-images-bucket',
  ].map((name) => `app/api/admin/${name}/route.ts`)
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === 'route.ts' || entry.name === 'route.tsx') out.push(full);
  }
  return out;
}

/** Blank out comments and string contents so braces and names inside them are not counted. */
function stripCommentsAndStrings(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if (c === "'" || c === '"') {
      out += c;
      i++;
      while (i < src.length && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\') i++;
        else out += src[i]; // keep text: 'admin' in a comparison matters
        i++;
      }
      out += c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index just past the bracket that closes the one at `open`. */
function matchBracket(src: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const openCh = src[open];
  const closeCh = pairs[openCh];
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === openCh) depth++;
    else if (src[i] === closeCh && --depth === 0) return i + 1;
  }
  return src.length;
}

/** Body text of a function whose parameter list opens at `paren`. */
function bodyAfterParams(src: string, paren: number): string {
  const afterParams = matchBracket(src, paren);
  const arrow = src.indexOf('=>', afterParams);
  const brace = src.indexOf('{', afterParams);
  if (brace === -1) return src.slice(afterParams);
  // Arrow function with an expression body: take the rest of the statement.
  if (arrow !== -1 && arrow < brace && src.slice(arrow + 2, brace).trim() !== '') {
    const end = src.indexOf('\n\n', arrow);
    return src.slice(arrow, end === -1 ? src.length : end);
  }
  return src.slice(brace, matchBracket(src, brace));
}

/** Bodies of all functions declared in the file, by name. */
function localFunctions(src: string): Map<string, string> {
  const fns = new Map<string, string>();
  const decl = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/g;
  const arrow = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?\(/g;
  for (const re of [decl, arrow]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      fns.set(m[1], bodyAfterParams(src, m.index + m[0].length - 1));
    }
  }
  return fns;
}

function hasDirectCheck(body: string): boolean {
  if (body.includes('requireAdmin(')) return true;
  return /getUser\s*\(/.test(body) && /user_type/.test(body) && /['"]admin['"]/.test(body);
}

function isGuarded(body: string, fns: Map<string, string>, seen = new Set<string>()): boolean {
  if (hasDirectCheck(body)) return true;
  for (const [name, fnBody] of Array.from(fns)) {
    if (seen.has(name)) continue;
    if (new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}\\s*\\(`).test(body)) {
      seen.add(name);
      if (isGuarded(fnBody, fns, seen)) return true;
    }
  }
  return false;
}

/** Exported handlers in a route file: name and body text. */
function exportedHandlers(src: string): { name: string; body: string }[] {
  const handlers: { name: string; body: string }[] = [];
  const names = METHODS.join('|');

  const fnRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+(${names})\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(src))) {
    handlers.push({ name: m[1], body: bodyAfterParams(src, m.index + m[0].length - 1) });
  }

  // export const GET = async (...) => {...}  /  export const GET = wrapper(...)  /  export const GET = otherFn
  const constRe = new RegExp(`export\\s+const\\s+(${names})\\b[^=]*=`, 'g');
  while ((m = constRe.exec(src))) {
    const start = m.index + m[0].length;
    const next = src.slice(start).search(/\n(?:export\s|(?:async\s+)?function\s)/);
    handlers.push({ name: m[1], body: src.slice(start, next === -1 ? src.length : start + next) });
  }

  // export { GET, handler as POST } — cannot be checked from this file's text alone.
  const listRe = /export\s*\{([^}]*)\}/g;
  while ((m = listRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const [local, alias] = part.trim().split(/\s+as\s+/);
      const exported = (alias || local || '').trim();
      if (METHODS.includes(exported)) handlers.push({ name: exported, body: `${local.trim()}(` });
    }
  }
  return handlers;
}

function main() {
  const files = walk(ADMIN_API).sort();
  const failures: string[] = [];
  let checked = 0;
  let skipped = 0;
  let handlerCount = 0;

  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (PENDING_DELETE.has(rel)) {
      skipped++;
      continue;
    }
    checked++;
    const src = stripCommentsAndStrings(fs.readFileSync(file, 'utf8'));
    const fns = localFunctions(src);
    for (const handler of exportedHandlers(src)) {
      handlerCount++;
      if (!isGuarded(handler.body, fns)) failures.push(`${rel}  ${handler.name}`);
    }
  }

  if (failures.length > 0) {
    console.error(`Admin route guard check FAILED: ${failures.length} handler(s) with no admin check:\n`);
    for (const failure of failures) console.error(`  ${failure}`);
    console.error(`\nAdd as the first statements of each handler:\n  const denied = await requireAdmin();\n  if (denied) return denied;`);
    process.exit(1);
  }

  console.log(
    `Admin route guard check passed: ${handlerCount} handlers in ${checked} route files` +
      (skipped ? ` (${skipped} skipped: pending deletion)` : '')
  );
}

main();
