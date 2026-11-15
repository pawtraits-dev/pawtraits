/** Run: NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/test-csp.ts
 *  Unit tests for the CSP report-only trial: lib/security/csp.ts and lib/security/csp-reports.ts */
import {
  buildEnforcedCsp, buildReportOnlyCsp, generateNonce, isCspReportOnlyEnabled, reportingEndpointsHeader, wantsHtmlDocument,
} from "../lib/security/csp";
import {
  MAX_BODY_BYTES, aggregateReports, blockedKey, isNoiseUrl, normalisePath, originAndPath, parseReportBody, readBodyLimited, userAgentFamily,
} from "../lib/security/csp-reports";

let failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`}`);
}
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

// ---- 1. The enforced policy, pinned byte-for-byte as it was in middleware.ts BEFORE the refactor
const PINNED_ENFORCED = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.js.stripe.com https://pay.google.com https://maps.googleapis.com https://vercel.live https://www.googletagmanager.com https://connect.facebook.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com https://*.g.doubleclick.net https://www.google.com https://www.google.co.uk https://www.facebook.com https://res.cloudinary.com https://lh3.googleusercontent.com https://images.unsplash.com https://*.stripe.com https://*.supabase.co https://pawtraits.pics https://www.pawtraits.pics; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://www.facebook.com https://connect.facebook.net https://api.stripe.com https://upload.stripe.com https://*.stripe.com https://*.stripe.network https://*.link.com https://pay.google.com https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.cloudinary.com https://res.cloudinary.com https://vercel.live wss://ws-us3.pusher.com; frame-src 'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://pay.google.com https://*.link.com https://td.doubleclick.net https://www.googletagmanager.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
eq("enforced policy is byte-for-byte the pre-change string", buildEnforcedCsp(), PINNED_ENFORCED);

// ---- 2. Report-only policy
const nonce = "dGVzdG5vbmNlMTIzNDU2Nw==";
const ro = buildReportOnlyCsp(nonce);
const dirs = (s: string) => s.split("; ");
const name = (d: string) => d.split(" ")[0];
const enforcedDirs = dirs(PINNED_ENFORCED);
const roDirs = dirs(ro);
console.log("report-only (sample nonce):\n" + ro + "\n");
eq("nonce appears exactly once", ro.split(nonce).length - 1, 1);
eq("no unsafe-eval in report-only", ro.includes("unsafe-eval"), false);
eq("script-src is nonce + strict-dynamic + fallbacks", roDirs.find((d) => name(d) === "script-src"), `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`);
const sameOthers = enforcedDirs.filter((d) => name(d) !== "script-src" && name(d) !== "upgrade-insecure-requests");
eq("every other enforced directive is identical, in order", roDirs.slice(0, 0).concat(roDirs.filter((d) => sameOthers.includes(d))), sameOthers);
eq("added directives are only report-uri and report-to", roDirs.filter((d) => !enforcedDirs.includes(d) && name(d) !== "script-src").map(name), ["report-uri", "report-to"]);
eq("report-uri / report-to values", roDirs.slice(-2), ["report-uri /api/csp-report", "report-to csp"]);
eq("upgrade-insecure-requests omitted (ignored, and warns, when report-only)", ro.includes("upgrade-insecure-requests"), false);
eq("object-src none and base-uri self present", [ro.includes("object-src 'none'"), ro.includes("base-uri 'self'")], [true, true]);
eq("Reporting-Endpoints value", reportingEndpointsHeader(), 'csp="/api/csp-report"');
eq("enforced policy does not depend on the nonce or on building the report-only one", buildEnforcedCsp(), PINNED_ENFORCED);

// ---- nonce
const n1 = generateNonce(), n2 = generateNonce();
eq("nonce is base64 of 16 bytes (24 chars)", /^[A-Za-z0-9+/]{22}==$/.test(n1), true);
eq("nonces differ", n1 !== n2, true);
eq("nonce has no CSP/HTML-hostile characters", /['"<>&; ]/.test(n1), false);

// ---- kill switch and HTML detection
eq("kill switch: unset = on", isCspReportOnlyEnabled(undefined), true);
eq("kill switch: off", isCspReportOnlyEnabled("off"), false);
eq("kill switch: OFF with spaces", isCspReportOnlyEnabled(" OFF "), false);
eq("kill switch: other value = on", isCspReportOnlyEnabled("on"), true);
const nav = { "sec-fetch-dest": "document", accept: "text/html,*/*" };
eq("html: browser navigation", wantsHtmlDocument("GET", "/browse", h(nav)), true);
eq("html: no sec-fetch, accept html", wantsHtmlDocument("GET", "/", h({ accept: "text/html" })), true);
eq("html: api excluded", wantsHtmlDocument("GET", "/api/x", h(nav)), false);
eq("html: _next excluded", wantsHtmlDocument("GET", "/_next/data/x", h(nav)), false);
eq("html: file with extension excluded", wantsHtmlDocument("GET", "/assets/a.png", h(nav)), false);
eq("html: image request excluded", wantsHtmlDocument("GET", "/x", h({ "sec-fetch-dest": "image", accept: "text/html" })), false);
eq("html: RSC fetch excluded", wantsHtmlDocument("GET", "/browse", h({ rsc: "1", accept: "text/x-component" })), false);
eq("html: POST excluded", wantsHtmlDocument("POST", "/browse", h(nav)), false);

// ---- 3. Report parsing
const legacy = JSON.stringify({ "csp-report": {
  "document-uri": "https://www.pawtraits.com/customise/0b9e5c0e-1111-4222-8333-444455556666?utm=1#x",
  "blocked-uri": "https://cdn.evil.example/a/b.js?token=1", "effective-directive": "script-src-elem",
  "violated-directive": "script-src-elem", disposition: "report", "script-sample": "x".repeat(300),
  "source-file": "https://www.pawtraits.com/_next/static/chunks/a.js?v=2", "line-number": 12,
} });
const p1 = parseReportBody("application/csp-report", legacy, "Mozilla/5.0 Chrome/120.0 Safari/537.36");
eq("legacy: parsed", p1.ok && p1.reports.length, 1);
if (p1.ok) {
  const r = p1.reports[0];
  eq("legacy: directive", r.effectiveDirective, "script-src-elem");
  eq("legacy: blocked origin, path and query stripped", r.blocked, "https://cdn.evil.example");
  eq("legacy: document path, id replaced, query dropped", r.documentPath, "/customise/:id");
  eq("legacy: sample capped at 120", r.sample?.length, 120);
  eq("legacy: source file origin+path only", r.sourceFile, "https://www.pawtraits.com/_next/static/chunks/a.js");
  eq("legacy: line number and ua family", [r.lineNumber, r.userAgentFamily, r.disposition], [12, "Chrome", "report"]);
}
const modern = JSON.stringify([
  { type: "csp-violation", url: "https://www.pawtraits.com/browse?type=dogs", user_agent: "Mozilla/5.0 Firefox/120.0",
    body: { documentURL: "https://www.pawtraits.com/browse?type=dogs", blockedURL: "inline", effectiveDirective: "script-src-elem", disposition: "report", sample: "self.__next_f.push([1,\"a\"])", sourceFile: "https://www.pawtraits.com/browse", lineNumber: 3 } },
  { type: "deprecation", url: "https://x/", body: {} },
  { type: "csp-violation", url: "https://www.pawtraits.com/", body: { documentURL: "https://www.pawtraits.com/", blockedURL: "eval", effectiveDirective: "script-src", disposition: "enforce" } },
]);
const p2 = parseReportBody("application/reports+json; charset=utf-8", modern, null);
eq("reports+json: only csp-violation items", p2.ok && p2.reports.map((r) => [r.blocked, r.effectiveDirective, r.disposition, r.userAgentFamily]), [["inline", "script-src-elem", "report", "Firefox"], ["eval", "script-src", "enforce", "Other"]]);
eq("reports+json: path /browse, no query", p2.ok && p2.reports[0].documentPath, "/browse");
eq("wrong content type ignored", parseReportBody("application/json", legacy, null), { ok: false, reason: "content-type" });
eq("malformed JSON ignored", parseReportBody("application/csp-report", "{nope", null), { ok: false, reason: "invalid" });
eq("legacy body without csp-report ignored", parseReportBody("application/csp-report", "{}", null), { ok: false, reason: "invalid" });
eq("reports+json non-array ignored", parseReportBody("application/reports+json", "{}", null), { ok: false, reason: "invalid" });

// ---- noise
const noisy = (blocked: string, source = "", directive = "script-src-elem") =>
  parseReportBody("application/csp-report", JSON.stringify({ "csp-report": { "document-uri": "https://a.b/", "blocked-uri": blocked, "effective-directive": directive, "source-file": source } }), null);
for (const u of ["chrome-extension://abc/x.js", "moz-extension://abc/x.js", "safari-web-extension://abc/x.js", "webkit-masked-url://hidden/", "about:blank"]) {
  eq("noise dropped: blocked " + u, noisy(u).ok && (noisy(u) as any).reports.length, 0);
}
eq("noise dropped: extension source file", (noisy("inline", "moz-extension://abc/c.js") as any).reports.length, 0);
eq("noise dropped: empty with no directive", (noisy("", "", "") as any).reports.length, 0);
eq("not noise: ordinary inline", (noisy("inline") as any).reports.length, 1);
eq("isNoiseUrl", [isNoiseUrl("CHROME-EXTENSION://x"), isNoiseUrl("https://x"), isNoiseUrl(undefined)], [true, false, false]);

// ---- key normalisation
eq("blocked: keywords", ["inline", "eval", "data:image/png;base64,AAAA", "blob:https://a/b", "self"].map((b) => blockedKey(b, "script-src")), ["inline", "eval", "data", "blob", "self"]);
eq("blocked: origin keeps port, drops path/query", blockedKey("https://a.example:8443/p/q?x=1", "img-src"), "https://a.example:8443");
eq("blocked: empty script -> inline, empty other -> unknown", [blockedKey("", "script-src-elem"), blockedKey("", "frame-ancestors")], ["inline", "unknown"]);
eq("path: uuid, digits, short code, hex", normalisePath("https://x.com/orders/12345/item/0b9e5c0e-1111-4222-8333-444455556666/s/1123M/CAMDEN?a=b"), "/orders/:id/item/:id/s/:id/CAMDEN");
eq("path: plain words kept, query and hash dropped", normalisePath("https://x.com/pawsonalities/dog/enfb?breed=1#top"), "/pawsonalities/dog/enfb");
eq("path: root and garbage", [normalisePath("https://x.com"), normalisePath(undefined)], ["/", "/"]);
eq("originAndPath: strips query/hash, rejects non-http", [originAndPath("https://a.com/x.js?v=1#h"), originAndPath("chrome-extension://a/b.js"), originAndPath("")], ["https://a.com/x.js", null, null]);
eq("ua families", ["Mozilla/5.0 Edg/120 Chrome/120 Safari/537", "Mozilla/5.0 (iPhone) Version/17 Safari/604", "Googlebot/2.1", "", "curl/8"].map(userAgentFamily), ["Edge", "Safari", "Bot", "Other", "Other"]);
const agg = aggregateReports([...(p1.ok ? p1.reports : []), ...(p1.ok ? p1.reports : [])]);
eq("aggregate: same key collapses with count", [agg.length, agg[0].count], [1, 2]);

// ---- size limits
eq("body over 16 KB rejected by parser", parseReportBody("application/csp-report", " ".repeat(MAX_BODY_BYTES + 1), null), { ok: false, reason: "too-large" });
const many = JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ type: "csp-violation", body: { documentURL: "https://a.b/p", blockedURL: "https://h" + i + ".example/x", effectiveDirective: "script-src-elem" } })));
const pm = parseReportBody("application/reports+json", many, null);
eq("at most 20 reports per request", pm.ok && [pm.reports.length, pm.truncated], [20, true]);
(async () => {
  const big = new Request("https://a.b/api/csp-report", { method: "POST", body: "x".repeat(MAX_BODY_BYTES + 10) });
  eq("readBodyLimited: oversize stream gives null", await readBodyLimited(big), null);
  const big2 = new Request("https://a.b/api/csp-report", { method: "POST", headers: { "content-length": String(MAX_BODY_BYTES + 1) }, body: "{}" });
  eq("readBodyLimited: oversize content-length gives null", await readBodyLimited(big2), null);
  eq("readBodyLimited: small body read", await readBodyLimited(new Request("https://a.b/", { method: "POST", body: "{\"a\":1}" })), "{\"a\":1}");
  console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
  process.exit(failed ? 1 : 0);
})();
