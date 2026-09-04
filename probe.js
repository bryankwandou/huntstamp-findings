// Second sweep over the Polymarket integration, covering ground the first pass missed:
// routing and error handling, search edge cases, price arithmetic across the whole grid,
// category counts against what actually renders, document metadata and heading order.
//
//   node probe.js
//
// Writes probe-results.json. Read-only: no orders, no wallet, no funds.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = "https://app.manic.trade";
const NAV = { waitUntil: "domcontentloaded", timeout: 120000 };
const out = { startedAt: new Date().toISOString(), probes: {} };

async function settle(page, text, timeout = 90000) {
  try {
    await page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function probe(name, fn) {
  process.stdout.write("· " + name + " … ");
  try {
    const r = await fn();
    out.probes[name] = r;
    console.log("ok");
  } catch (e) {
    const msg = String(e.message).split("\n")[0];
    out.probes[name] = { error: msg };
    console.log("failed: " + msg);
  }
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ---------------------------------------------------------------- routing
  await probe("routes", async () => {
    const targets = [
      "/pm",
      "/pm/",
      "/PM",
      "/pm/event/this-market-does-not-exist-2099",
      "/pm/event/",
      "/pm/event/../../etc",
      "/pm/nonsense-subroute",
    ];
    const rows = [];
    for (const t of targets) {
      const res = await page.goto(BASE + t, NAV).catch(() => null);
      await page.waitForTimeout(6000);
      const text = await page.evaluate(() => document.body.innerText.slice(0, 200));
      rows.push({
        requested: t,
        httpStatus: res ? res.status() : null,
        landedOn: new URL(page.url()).pathname,
        looksLikeError: /not found|404|something went wrong|error/i.test(text),
        firstText: text.replace(/\s+/g, " ").slice(0, 120),
      });
      await page.evaluate(() => localStorage.removeItem("pm-events-store"));
    }
    return rows;
  });

  // ------------------------------------------------------- grid arithmetic
  await probe("gridPrices", async () => {
    await page.goto(BASE + "/pm", NAV);
    await settle(page, "Trending");
    await page.waitForTimeout(8000);
    return await page.evaluate(() => {
      const lines = document.body.innerText.split("\n").map((s) => s.trim());
      // A binary card renders two outcome rows back to back; collect adjacent
      // percentage pairs and check the ones that claim to be complements.
      const pcts = [];
      lines.forEach((l, i) => {
        const m = l.match(/^(\d+(?:\.\d+)?)%$/);
        if (m) pcts.push({ i, v: parseFloat(m[1]), label: lines[i - 1] || "" });
      });
      const pairs = [];
      for (let k = 0; k < pcts.length - 1; k++) {
        if (pcts[k + 1].i - pcts[k].i <= 3) {
          const sum = +(pcts[k].v + pcts[k + 1].v).toFixed(1);
          pairs.push({ a: pcts[k].label, av: pcts[k].v, b: pcts[k + 1].label, bv: pcts[k + 1].v, sum });
        }
      }
      return {
        totalPercentages: pcts.length,
        adjacentPairs: pairs.length,
        sumsOver100: pairs.filter((p) => p.sum > 100),
        sumsExactly100: pairs.filter((p) => p.sum === 100).length,
        zeroOrHundred: pcts.filter((p) => p.v === 0 || p.v === 100).length,
      };
    });
  });

  // --------------------------------------------------- unpriced outcomes
  await probe("unpricedOutcomes", async () => {
    return await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        dashPriceRows: (t.match(/^--$/gm) || []).length,
        dashVolume: (t.match(/--\s*Vol/g) || []).length,
        emptyPriceTokens: (t.match(/\s--\s/g) || []).length,
      };
    });
  });

  // ------------------------------------------------- category count truth
  await probe("categoryCounts", async () => {
    return await page.evaluate(() => {
      // Chips render as "<name> <count>"; collect them and flag zeros.
      const chips = [...document.querySelectorAll("button")]
        .map((b) => b.innerText.replace(/\s+/g, " ").trim())
        .filter((t) => /^[A-Za-z][A-Za-z0-9 .&'/-]{1,40} \d+$/.test(t))
        .map((t) => {
          const m = t.match(/^(.*) (\d+)$/);
          return { label: m[1], count: parseInt(m[2], 10) };
        });
      return {
        chips: chips.length,
        zeroCount: chips.filter((c) => c.count === 0),
        sample: chips.slice(0, 12),
      };
    });
  });

  // ------------------------------------------------------ search handling
  await probe("searchEdgeCases", async () => {
    const rows = [];
    const queries = [
      { q: "<img src=x onerror=alert(1)>", why: "markup in the query" },
      { q: "'; DROP TABLE markets;--", why: "quote and semicolon" },
      { q: "   ", why: "whitespace only" },
      { q: "ﬀﬁ🎾🇺🇸", why: "ligatures, emoji, flag" },
      { q: "z".repeat(400), why: "400 characters" },
      { q: "BITCOIN", why: "case sensitivity" },
    ];
    for (const { q, why } of queries) {
      const box = page.locator('input[placeholder="Search markets"]:visible').first();
      await box.click({ timeout: 20000 });
      await box.fill("");
      await box.fill(q);
      await page.waitForTimeout(3500);
      const r = await page.evaluate(() => {
        const t = document.body.innerText;
        return {
          bodyLength: t.length,
          noResults: /no markets|no results|nothing found/i.test(t),
          alertFired: window.__alertFired === true,
          cards: document.querySelectorAll('[class*="cursor-pointer"]').length,
        };
      });
      rows.push({ query: q.length > 40 ? q.slice(0, 40) + "…" : q, why, ...r });
      await box.fill("");
      await page.waitForTimeout(1500);
    }
    return rows;
  });

  // ------------------------------------------------- document + structure
  await probe("documentMetadata", async () => {
    await page.goto(BASE + "/pm", NAV);
    await settle(page, "Trending");
    await page.waitForTimeout(5000);
    const dir = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || null,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content || null,
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      lang: document.documentElement.lang || null,
      h1Count: document.querySelectorAll("h1").length,
      headingOrder: [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => h.tagName).slice(0, 14),
      landmarks: {
        main: document.querySelectorAll("main").length,
        nav: document.querySelectorAll("nav").length,
      },
      inputsWithoutLabel: [...document.querySelectorAll("input")].filter(
        (i) => !i.getAttribute("aria-label") && !i.labels?.length && !i.getAttribute("aria-labelledby")
      ).length,
      buttonsWithoutName: [...document.querySelectorAll("button")].filter(
        (b) => !b.innerText.trim() && !b.getAttribute("aria-label") && !b.title
      ).length,
    }));

    await page.goto(BASE + "/pm/event/atp-faria-alcaraz-2026-09-02", NAV);
    await settle(page, "Settlement Time");
    await page.waitForTimeout(6000);
    const ev = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || null,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content || null,
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      h1Count: document.querySelectorAll("h1").length,
    }));
    return { directory: dir, eventPage: ev, titlesIdentical: dir.title === ev.title };
  });

  // --------------------------------------------- resolved markets in feed
  await probe("resolvedInFeed", async () => {
    await page.goto(BASE + "/pm", NAV);
    await settle(page, "Trending");
    await page.waitForTimeout(8000);
    return await page.evaluate(() => {
      const t = document.body.innerText;
      const at100 = (t.match(/\b100(\.0)?%/g) || []).length;
      const at0 = (t.match(/(^|\s)0%/g) || []).length;
      return {
        pricesAt100: at100,
        pricesAt0: at0,
        resolvedBadges: (t.match(/Resolved|Market Ended|Settled/g) || []).length,
        note: "A card priced at 100% or 0% in the feed has effectively settled; a Resolved badge count of 0 alongside them means the feed does not label them.",
      };
    });
  });

  // ------------------------------------------------------- console errors
  const console_ = [];
  ctx.on("console", (m) => {
    if (m.type() === "error") console_.push(m.text().slice(0, 220));
  });
  const pageErrors = [];
  ctx.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 220)));

  await probe("errorsWhileBrowsing", async () => {
    await page.goto(BASE + "/pm", NAV);
    await settle(page, "Trending");
    await page.waitForTimeout(6000);
    // click through a few cards to exercise the app
    const cards = page.locator('[class*="cursor-pointer"]');
    const n = Math.min(await cards.count(), 3);
    for (let i = 0; i < n; i++) {
      await cards.nth(i).click({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(5000);
      await page.goBack(NAV).catch(() => {});
      await page.waitForTimeout(4000);
    }
    return {
      consoleErrors: [...new Set(console_)].slice(0, 12),
      consoleErrorCount: console_.length,
      uncaughtPageErrors: [...new Set(pageErrors)].slice(0, 8),
    };
  });

  // ------------------------------------------------------ failed requests
  await probe("failedRequests", async () => {
    return await page.evaluate(() => {
      const r = performance.getEntriesByType("resource");
      return {
        totalResources: r.length,
        zeroSized: r.filter((e) => e.transferSize === 0 && e.decodedBodySize === 0).length,
        slowest: r
          .slice()
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .map((e) => ({ name: e.name.split("/").pop().slice(0, 46), ms: Math.round(e.duration) })),
      };
    });
  });

  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, "probe-results.json"), JSON.stringify(out, null, 2), "utf8");
  await browser.close();
  console.log("\nwritten: probe-results.json");
}

main().catch((e) => {
  console.error("probe failed:", e.message);
  fs.writeFileSync(
    path.join(__dirname, "probe-results.json"),
    JSON.stringify(out, null, 2),
    "utf8"
  );
  process.exit(1);
});
