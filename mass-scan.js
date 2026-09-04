// Scan every event page the sitemap advertises, using the server-rendered HTML.
//
//   node mass-scan.js
//
// The app is client-rendered, so prices are not in the HTML — but <title>, the
// meta description and the Open Graph tags are, and those are what link
// previews and search engines consume. Checking all of them is cheap and covers
// ground a browser-driven pass cannot reach at this scale.
//
// Read-only: GET requests to public pages, nothing authenticated, no orders.

const fs = require("fs");
const https = require("https");

const HOST = "app.manic.trade";
const CONCURRENCY = 4;          // polite: the site is a live production service
const SAMPLE = 60;              // a sample, not all 485: each page is 1.5 MB of their egress
const DELAY_MS = 250;           // spacing between requests per worker

function get(path) {
  return new Promise((resolve) => {
    const req = https.request(
      { host: HOST, path, method: "GET", headers: { "User-Agent": "manic-bounty-scan/1.0" } },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { body += c; });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on("error", (e) => resolve({ status: 0, error: e.message, body: "", headers: {} }));
    req.setTimeout(45000, () => { req.destroy(); resolve({ status: 0, error: "timeout", body: "", headers: {} }); });
    req.end();
  });
}

const meta = (html, re) => (html.match(re) || [])[1] || null;

const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

/** "Ends Sep 9" -> a Date in the nearest sensible year, or null. */
function parseEnds(desc, today) {
  const m = desc && desc.match(/Ends\s+([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (!m) return null;
  const mo = MONTHS[m[1]];
  if (mo === undefined) return null;
  return new Date(Date.UTC(today.getUTCFullYear(), mo, parseInt(m[2], 10)));
}

/** The date encoded in the slug, e.g. atp-foo-bar-2026-09-02. */
function slugDate(slug) {
  const m = slug.match(/(20\d\d)-(\d\d)-(\d\d)$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

async function main() {
  const today = new Date();
  console.log("fetching sitemap…");
  const sm = await get("/sitemap.xml");
  const urls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const events = urls.filter((u) => u.includes("/pm/event/"));
  const others = urls.filter((u) => !u.includes("/pm/event/"));
  console.log(`  ${urls.length} urls, ${events.length} event pages, ${others.length} other routes`);

  // Take an evenly spread sample rather than the whole sitemap.
  const step = Math.max(1, Math.floor(events.length / SAMPLE));
  const sample = events.filter((_, i) => i % step === 0).slice(0, SAMPLE);
  console.log(`  sampling ${sample.length} of ${events.length} event pages (every ${step}th)`);

  const results = [];
  let done = 0;

  async function worker(list) {
    for (const url of list) {
      const path = new URL(url).pathname;
      const slug = path.split("/").pop();
      const r = await get(path);
      const html = r.body;

      const row = {
        slug,
        status: r.status,
        bytes: html.length,
        title: meta(html, /<title>([^<]*)<\/title>/),
        desc: meta(html, /<meta name="description" content="([^"]*)"/),
        ogTitle: meta(html, /<meta property="og:title" content="([^"]*)"/),
        ogDesc: meta(html, /<meta property="og:description" content="([^"]*)"/),
        ogImage: meta(html, /<meta property="og:image" content="([^"]*)"/),
        canonical: meta(html, /rel="canonical" href="([^"]*)"/),
        twitterCard: meta(html, /<meta name="twitter:card" content="([^"]*)"/),
        h1: (html.match(/<h1[ >]/g) || []).length,
        titleOffset: html.indexOf("<title>"),
        headCloseOffset: html.indexOf("</head>"),
        titleAfterHeadClose: html.indexOf("<title>") > html.indexOf("</head>"),
        mainCount: (html.match(/<main[ >]/g) || []).length,
      };

      row.slugDate = slugDate(slug) ? slugDate(slug).toISOString().slice(0, 10) : null;
      const ends = parseEnds(row.ogDesc, today);
      row.endsParsed = ends ? ends.toISOString().slice(0, 10) : null;

      // A market whose own slug date has passed, still advertising a future close.
      row.staleEnds =
        !!(row.slugDate && ends && new Date(row.slugDate) < today && ends > today);
      // Generic landing-page title on an event route = the soft-404 path.
      row.soft404 = /the First Momentum-based Trading Platform/.test(row.title || "");
      row.noCanonical = !row.canonical;
      row.noOgImage = !row.ogImage;
      row.noTwitterCard = !row.twitterCard;
      row.descEqualsOgDesc = row.desc === row.ogDesc;

      results.push(row);
      done++;
      if (done % 25 === 0) process.stdout.write(`  ${done}/${events.length}\n`);
      await new Promise((r2) => setTimeout(r2, DELAY_MS));
    }
  }

  const chunks = Array.from({ length: CONCURRENCY }, () => []);
  sample.forEach((u, i) => chunks[i % CONCURRENCY].push(u));
  await Promise.all(chunks.map(worker));

  // Other routes, checked the same way.
  const routes = [];
  for (const url of others) {
    const path = new URL(url).pathname;
    const r = await get(path);
    routes.push({
      path,
      status: r.status,
      bytes: r.body.length,
      title: meta(r.body, /<title>([^<]*)<\/title>/),
      desc: meta(r.body, /<meta name="description" content="([^"]*)"/),
      canonical: meta(r.body, /rel="canonical" href="([^"]*)"/),
      h1: (r.body.match(/<h1[ >]/g) || []).length,
      mainCount: (r.body.match(/<main[ >]/g) || []).length,
      ogImage: meta(r.body, /<meta property="og:image" content="([^"]*)"/),
    });
    await new Promise((r2) => setTimeout(r2, DELAY_MS));
  }

  const ok = results.filter((r) => r.status === 200);
  const summary = {
    scannedAt: new Date().toISOString(),
    eventsInSitemap: events.length,
    sampled: sample.length,
    fetched: results.length,
    nonOk: results.filter((r) => r.status !== 200).length,
    staleEnds: ok.filter((r) => r.staleEnds).length,
    staleEndsSample: ok.filter((r) => r.staleEnds).slice(0, 12)
      .map((r) => ({ slug: r.slug, slugDate: r.slugDate, ogDesc: r.ogDesc })),
    soft404: ok.filter((r) => r.soft404).length,
    soft404Sample: ok.filter((r) => r.soft404).slice(0, 8).map((r) => r.slug),
    withoutCanonical: ok.filter((r) => r.noCanonical).length,
    withoutOgImage: ok.filter((r) => r.noOgImage).length,
    withoutTwitterCard: ok.filter((r) => r.noTwitterCard).length,
    withoutH1: ok.filter((r) => r.h1 === 0).length,
    twoMains: ok.filter((r) => r.mainCount === 2).length,
    titleAfterHeadClose: ok.filter((r) => r.titleAfterHeadClose).length,
    titleOffsetMin: Math.min(...ok.map((r) => r.titleOffset)),
    titleOffsetMax: Math.max(...ok.map((r) => r.titleOffset)),
    titleBeyond256k: ok.filter((r) => r.titleOffset > 262144).length,
    duplicateTitles: (() => {
      const c = {};
      ok.forEach((r) => { c[r.title] = (c[r.title] || 0) + 1; });
      return Object.entries(c).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 10);
    })(),
    emptyDescriptions: ok.filter((r) => !r.desc).length,
    bytesMin: Math.min(...ok.map((r) => r.bytes)),
    bytesMax: Math.max(...ok.map((r) => r.bytes)),
    bytesMean: Math.round(ok.reduce((s, r) => s + r.bytes, 0) / (ok.length || 1)),
    routes,
  };

  fs.writeFileSync("mass-scan.json", JSON.stringify({ summary, results }, null, 2));
  console.log("\n=== summary ===");
  for (const [k, v] of Object.entries(summary)) {
    if (k === "routes" || k.endsWith("Sample") || k === "duplicateTitles") continue;
    console.log(`  ${k}: ${v}`);
  }
  console.log("\n  duplicate titles:", JSON.stringify(summary.duplicateTitles));
  console.log("  stale sample:", JSON.stringify(summary.staleEndsSample.slice(0, 4), null, 1));
  console.log("\nwritten: mass-scan.json");
}

main().catch((e) => { console.error("scan failed:", e.message); process.exit(1); });
