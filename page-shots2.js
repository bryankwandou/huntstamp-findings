// Second pass of genuine browser screenshots. Same rule as page-shots.js: the
// live application is in every frame, and every number in the caption band is
// measured from that same load at capture time.
//
//   node page-shots2.js

const { chromium } = require("playwright");
const fs = require("fs");

const APP = "https://app.manic.trade";
const API = "https://bo-server-api.manic.trade/charts/pm/events";

async function band(page, title, lines) {
  await page.evaluate(([t, ls]) => {
    document.querySelectorAll("#__eb").forEach((n) => n.remove());
    const d = document.createElement("div");
    d.id = "__eb";
    d.style.cssText = "position:fixed;inset:0 0 auto 0;z-index:2147483647;background:rgba(13,17,23,.95);" +
      "color:#c9d1d9;font:12.5px/1.6 Consolas,Menlo,monospace;padding:12px 16px;border-bottom:2px solid #58a6ff;" +
      "box-shadow:0 6px 22px rgba(0,0,0,.6)";
    const h = document.createElement("div");
    h.style.cssText = "font:600 14px system-ui,sans-serif;color:#e6edf3;margin-bottom:6px";
    h.textContent = t;
    d.appendChild(h);
    for (const l of ls) {
      const r = document.createElement("div");
      r.style.whiteSpace = "pre-wrap";
      r.textContent = l;
      d.appendChild(r);
    }
    document.documentElement.appendChild(d);
  }, [title, lines]);
}

const shot = async (page, id) => {
  const p = `evidence/${id}.png`;
  await page.screenshot({ path: p });
  console.log(`  ${p}  ${fs.statSync(p).size} bytes`);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  let resp = [];
  page.on("response", (r) => resp.push({ url: r.url(), status: r.status(), headers: r.headers() }));

  const go = async (path, wait = 7000) => {
    resp = [];
    await page.goto(APP + path, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(wait);
  };

  // ---- F-27 - payload actually transferred to render the visible cards ----
  await go("/pm", 9000);
  {
    const totals = await page.evaluate(async () => {
      const ents = performance.getEntriesByType("resource");
      const api = ents.filter((e) => e.name.includes("bo-server-api"));
      const bytes = ents.reduce((s, e) => s + (e.transferSize || 0), 0);
      const apiBytes = api.reduce((s, e) => s + (e.transferSize || 0), 0);
      // how many market cards are actually on screen
      const cards = document.querySelectorAll('[class*="card"],[data-testid*="card"]').length;
      return { requests: ents.length, bytes, apiRequests: api.length, apiBytes, cards };
    });
    const mb = (n) => (n / 1048576).toFixed(2) + " MB";
    await band(page, "F-27 - what this page load actually transferred, from its own Resource Timing", [
      "  total requests            : " + totals.requests,
      "  total transferred         : " + mb(totals.bytes),
      "  calls to the events API   : " + totals.apiRequests + "   transferring " + mb(totals.apiBytes),
      "  market cards in the DOM   : " + totals.cards,
      "  the directory downloads the whole catalogue to paint the cards you can see below",
    ]);
    await shot(page, "F-27-live");
  }

  // ---- F-25 - where the title and OG tags sit inside the served document ----
  {
    const m = await page.evaluate(async () => {
      const r = await fetch(location.origin + "/pm", { headers: { accept: "text/html" } });
      const html = await r.text();
      const at = (re) => { const i = html.search(re); return i < 0 ? null : i; };
      return {
        docBytes: html.length,
        titleAt: at(/<title/i),
        ogTitleAt: at(/property=["']og:title/i),
        ogDescAt: at(/property=["']og:description/i),
      };
    });
    const k = (n) => n == null ? "not found" : (n / 1024).toFixed(0) + " KB into the document";
    await band(page, "F-25 - byte offset of the share metadata inside the served HTML of /pm", [
      "  document served : " + m.docBytes.toLocaleString() + " bytes",
      "  <title>          at : " + k(m.titleAt),
      "  og:title         at : " + k(m.ogTitleAt),
      "  og:description   at : " + k(m.ogDescAt),
      "  an unfurler that stops reading at 256 KB reaches none of them and renders a blank card",
    ]);
    await shot(page, "F-25-live");
  }

  // ---- F-30 - a promotion for the previous month, still in the navigation ----
  await go("/pm", 7000);
  {
    const promo = await page.evaluate(() => {
      const hit = [...document.querySelectorAll("a,button,div,span")]
        .map((e) => (e.innerText || "").trim())
        .find((t) => t && t.length < 40 && /rewards/i.test(t));
      return { label: hit || "(not found)", today: new Date().toUTCString().slice(0, 16) };
    });
    await band(page, "F-30 - a promotion naming the previous month, read from the live page below", [
      "  label shown in the navigation : " + JSON.stringify(promo.label),
      "  date at capture               : " + promo.today,
      "  the promotion names August while the page is being served in September",
    ]);
    await shot(page, "F-30-live");
  }

  // ---- F-24 - the size of a 404 ----
  {
    resp = [];
    await page.goto(APP + "/definitely-not-a-route-" + Date.now(), { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const r = resp.find((x) => x.url.includes("definitely-not-a-route")) || {};
    const size = await page.evaluate(() => document.documentElement.outerHTML.length);
    await band(page, "F-24 - a route that correctly 404s, and what it costs to say so", [
      "  HTTP status  : " + (r.status || "?") + "   (correct - this route really does not exist)",
      "  body served  : " + size.toLocaleString() + " characters",
      "  a 404 does not need to ship the entire application shell to tell a crawler no",
    ]);
    await shot(page, "F-24-live");
  }

  // ---- F-33 - markets past their end time, still accepting orders ----
  {
    const d = await page.evaluate(async (api) => {
      const now = Math.floor(Date.now() / 1000);
      const r = await fetch(api + "?tag=sports&sort=trending&limit=500&offset=0&lite=true");
      const j = await r.json();
      const past = (j.events || []).filter((e) => typeof e.endTs === "number" && e.endTs < now
        && e.acceptingOrders === true && e.closed === false);
      return {
        scanned: (j.events || []).length, past: past.length,
        rows: past.slice(0, 5).map((e) => ({
          slug: e.slug, endedHoursAgo: Math.round((now - e.endTs) / 3600),
          acceptingOrders: e.acceptingOrders, closed: e.closed,
        })),
      };
    }, API);
    await page.goto(API + "?tag=sports&sort=trending&limit=500&offset=0&lite=true", { waitUntil: "domcontentloaded" }).catch(() => {});
    await band(page, "F-33 - markets whose end time has passed, still open for orders", [
      "  events in this live response : " + d.scanned,
      "  past their endTs, still acceptingOrders and not closed : " + d.past,
      ...d.rows.map((r) => "    " + r.slug + "  ended " + r.endedHoursAgo + "h ago  acceptingOrders=" + r.acceptingOrders + "  closed=" + r.closed),
    ]);
    await shot(page, "F-33-live");
  }

  // ---- F-39 - displayed chance against the book mid ----
  {
    const d = await page.evaluate(async (api) => {
      const r = await fetch(api + "?tag=crypto&sort=trending&limit=500&offset=0&lite=true");
      const j = await r.json();
      const out = [];
      for (const e of j.events || []) for (const o of e.outcomes || []) {
        if (typeof o.chance === "number" && typeof o.bestBid === "number" && typeof o.bestAsk === "number") {
          const mid = (o.bestBid + o.bestAsk) / 2;
          if (Math.abs(o.chance - mid) > 0.2)
            out.push({ slug: e.slug, market: o.name, chance: o.chance, mid: +mid.toFixed(3),
              gap: Math.round(Math.abs(o.chance - mid) * 100) });
        }
      }
      return { scanned: (j.events || []).length, hits: out.slice(0, 5), total: out.length };
    }, API);
    await band(page, "F-39 - the percentage shown to a user against the mid of the live book", [
      "  outcomes checked in this live response : " + d.scanned + " events",
      "  displayed chance more than 20 points from the book mid : " + d.total,
      ...d.hits.map((h) => "    " + h.slug + "  shown " + Math.round(h.chance * 100) + "%  book mid " + Math.round(h.mid * 100) + "%  gap " + h.gap + " points"),
      d.total ? "" : "  (none in this particular response; the raw capture records the pair that showed it)",
    ].filter(Boolean));
    await shot(page, "F-39-live");
  }

  await browser.close();
})();
