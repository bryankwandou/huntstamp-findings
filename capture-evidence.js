// Capture evidence for the Manic Polymarket findings.
//
//   node capture-evidence.js
//
// Screenshots go to evidence/ as real PNGs of the live application. Measurements
// that live in the console rather than on screen — timings, element counts,
// preload warnings — are written to evidence/measurements.json next to them, so
// a reviewer can check the number against the shot it came from.
//
// Nothing here fabricates a result. Every value is read from the page it claims
// to come from, and the run writes down which build it saw.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT = path.join(__dirname, "evidence");
const BASE = "https://app.manic.trade";
const EVENT = "/pm/event/atp-faria-alcaraz-2026-09-02";

// The route ships ~130 JS chunks and has taken over two minutes to reach its
// load event. Everything below waits on content, never on `load`.
const NAV = { waitUntil: "domcontentloaded", timeout: 180000 };

const results = { startedAt: new Date().toISOString(), findings: {} };

async function settle(page, text, timeout = 120000) {
  try {
    await page.waitForFunction(
      (t) => document.body.innerText.includes(t),
      text,
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("  saved", name);
  return file;
}

/** Run one capture stage. A stage that fails is recorded and the run continues. */
async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    const msg = String(e.message).split("\n")[0];
    console.log("  ! " + name + " failed:", msg);
    (results.failures = results.failures || []).push({ step: name, error: msg });
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // legible at full size rather than a blurry upload
  });

  const consoleLines = [];
  ctx.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));

  const page = await ctx.newPage();

  // ---- F-16, F-06, F-15, F-11, F-05, F-04 : the directory -------------------
  console.log("directory /pm");
  await page.goto(BASE + "/pm", NAV);
  const gridUp = await settle(page, "Trending");
  await page.waitForTimeout(4000);

  const build = await page.evaluate(() => {
    const m = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((n) => /dpl_/.test(n));
    return m ? m.match(/dpl_[A-Za-z0-9]+/)[0] : null;
  });
  results.build = build;
  results.gridRendered = gridUp;
  console.log("  build", build);

  await shot(page, "F-16-nav-august-rewards.png");
  await shot(page, "F-05-trending-grid.png");

  results.findings["F-16"] = await page.evaluate(() => ({
    navText: (document.body.innerText.match(/\w+ Rewards/) || [])[0] || null,
    clockNow: new Date().toISOString(),
  }));

  results.findings["F-06"] = await page.evaluate(() => {
    const p = [...new Set(document.body.innerText.match(/\d+(\.\d+)?%/g) || [])];
    return { total: p.length, withDecimal: p.filter((x) => x.includes(".")), all: p };
  });

  results.findings["F-15"] = await page.evaluate(() => {
    const zero = [...document.querySelectorAll("button,a,input")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width === 0 && r.height === 0 && e.tabIndex >= 0 && !e.disabled;
    });
    const imgs = [...document.querySelectorAll("img")];
    return {
      zeroSizedFocusable: zero.length,
      sample: zero.slice(0, 8).map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 24)),
      imagesTotal: imgs.length,
      imagesWithoutAlt: imgs.filter((i) => !i.alt).length,
    };
  });

  results.findings["F-10"] = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    const r = performance.getEntriesByType("resource");
    return {
      ttfbMs: Math.round(n.responseStart - n.requestStart),
      domContentLoadedMs: Math.round(n.domContentLoadedEventEnd),
      loadEventEndMs: Math.round(n.loadEventEnd),
      jsChunkRequests: r.filter((e) => /_next\/static\/chunks/.test(e.name)).length,
      totalResources: r.length,
    };
  });

  results.findings["F-11"] = await page.evaluate(() => {
    const t = document.body.innerText;
    return { dottedSpelling: t.includes("J.D. Vance"), plainSpelling: t.includes("JD Vance") };
  });

  // ---- F-12 : search then category ----------------------------------------
  console.log("search then category");
  await step("F-12 search then category", async () => {
    const search = page.locator('input[placeholder="Search markets"]:visible').first();
    await search.click({ timeout: 20000 });
    await search.fill("bitcoin");
    await page.waitForTimeout(5000);
    await shot(page, "F-12a-search-bitcoin.png");

    const politics = page.locator("button:visible", { hasText: /^Politics$/ }).first();
    await politics.click({ timeout: 20000 });
    await page.waitForTimeout(5000);
    await shot(page, "F-12b-query-cleared.png");
    results.findings["F-12"] = await page.evaluate(() => ({
      searchValuesAfterCategoryClick: [
        ...document.querySelectorAll('input[placeholder="Search markets"]'),
      ].map((i) => i.value),
    }));
  });

  // ---- F-02, F-03, F-07, F-08 : the settled event --------------------------
  console.log("event page");
  await page.evaluate(() => localStorage.removeItem("pm-events-store"));
  await page.goto(BASE + EVENT, NAV);
  await settle(page, "Settlement Time");
  await page.waitForTimeout(20000); // let the price chart finish drawing

  await shot(page, "F-03-settlement-vs-resolved.png");
  await shot(page, "F-07-props-rail-truncated.png");

  results.findings["F-03"] = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      settlementTime: (t.match(/Settlement Time\s*\n\s*([^\n]+)/) || [])[1] || null,
      resolved: /Resolved/.test(t),
      marketEnded: /Market Ended/.test(t),
      score: (t.match(/FT\s*\n\s*([\d\s-]+)/) || [])[1] || null,
      eventSlugDate: "2026-09-02",
    };
  });

  results.findings["F-02"] = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      outcomeBanner: (t.match(/OUTCOME:[^\n]*/) || [])[0] || null,
      pricePairs: [...t.matchAll(/(Jaime Faria|Carlos Alcaraz)\s*\n\s*(\d+(?:\.\d+)?)%/g)].map(
        (m) => `${m[1]} ${m[2]}%`
      ),
    };
  });

  results.findings["F-08"] = await page.evaluate(() => ({
    dashVolumeRows: (document.body.innerText.match(/--\s*Vol/g) || []).length,
  }));

  results.findings["F-07"] = await page.evaluate(() => {
    const rows = document.body.innerText
      .split("\n")
      .filter((l) => l.startsWith("US Open ATP: Jaime Faria vs Carlos Alcaraz "));
    return { propsPrefixedWithEventTitle: rows.length, sample: rows.slice(0, 4) };
  });

  // ---- F-01 : /pm restores the stored tab ---------------------------------
  console.log("F-01 stored tab overrides /pm");
  const before = await page.evaluate(() => localStorage.getItem("pm-events-store"));
  await page.goto(BASE + "/pm", NAV);
  await page.waitForTimeout(15000);
  await shot(page, "F-01-pm-redirected-to-event.png");
  results.findings["F-01"] = {
    requested: "/pm",
    landedOn: new URL(page.url()).pathname,
    storedStateBefore: before ? before.slice(0, 220) : null,
  };

  // ---- F-14 : empty state on mobile ---------------------------------------
  console.log("F-14 mobile empty state");
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 375, height: 812 });
  await mob.goto(BASE + "/pm", NAV);
  await mob.waitForTimeout(20000);
  await mob.screenshot({ path: path.join(OUT, "F-14-mobile.png") });
  console.log("  saved F-14-mobile.png");

  // ---- F-09 : preload warnings the browser reported itself ----------------
  const preload = consoleLines.filter((l) => /preloaded using link preload/.test(l));
  results.findings["F-09"] = {
    preloadWarningCount: preload.length,
    distinct: [...new Set(preload)],
  };
  fs.writeFileSync(path.join(OUT, "console.log"), consoleLines.join("\n"), "utf8");

  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(OUT, "measurements.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );

  await browser.close();

  console.log("\nbuild seen:", results.build);
  console.log("evidence written to", OUT);
  for (const [k, v] of Object.entries(results.findings)) {
    console.log(" ", k, JSON.stringify(v).slice(0, 150));
  }
}

main().catch((e) => {
  console.error("capture failed:", e.message);
  process.exit(1);
});
