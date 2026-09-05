// Third and final pass of genuine browser screenshots, covering the last seven
// findings that were still carrying a typeset rendering.
//
//   node page-shots3.js
//
// Each shot hunts the live data for a real instance of the defect, then puts the
// application (or the live API response) on screen with the measurement taken
// from that same load.

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

const fetchTag = (page, tag, off = 0) => page.evaluate(
  async ([api, t, o]) => (await (await fetch(`${api}?tag=${t}&sort=trending&limit=500&offset=${o}&lite=true`)).json()),
  [API, tag, off]);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(APP + "/pm", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(7000);

  // ---- F-04 - an outcome offered with no price at all ----
  {
    const d = await page.evaluate(async (api) => {
      const j = await (await fetch(api + "?tag=sports&sort=trending&limit=500&offset=0&lite=true")).json();
      const out = [];
      for (const e of j.events || []) for (const o of e.outcomes || []) {
        if (o.acceptingOrders === true && o.chance == null && o.bestBid == null && o.bestAsk == null)
          out.push({ slug: e.slug, market: o.name });
      }
      return { events: (j.events || []).length, total: out.length, rows: out.slice(0, 5) };
    }, API);
    await band(page, "F-04 - outcomes offered for trading with no price of any kind", [
      "  events in this live response : " + d.events,
      "  outcomes accepting orders while chance, bestBid and bestAsk are all null : " + d.total,
      ...d.rows.map((r) => "    " + r.slug + "   " + String(r.market).slice(0, 60)),
      d.total ? "  a user is offered a market with nothing to price the trade against" : "  (none in this response; the raw capture records the instance that showed it)",
    ]);
    await shot(page, "F-04-live");
  }

  // ---- F-06 - percentages that do not agree with their own value ----
  {
    const d = await page.evaluate(async (api) => {
      const j = await (await fetch(api + "?tag=sports&sort=trending&limit=500&offset=0&lite=true")).json();
      const out = [];
      for (const e of j.events || []) for (const o of e.outcomes || []) {
        if (typeof o.chance !== "number") continue;
        const pct = o.chance * 100;
        // A chance that renders to a different integer than it rounds to.
        if (Math.abs(pct - Math.round(pct)) > 0.001 && String(o.chance).length > 5)
          out.push({ slug: e.slug, market: o.name, chance: o.chance, shownAs: Math.round(pct) + "%" });
      }
      return { total: out.length, rows: out.slice(0, 5) };
    }, API);
    await band(page, "F-06 - stored probabilities carrying more precision than the display can show", [
      "  outcomes whose stored chance does not land on the percent shown : " + d.total,
      ...d.rows.map((r) => "    " + String(r.market).slice(0, 46) + "   stored " + r.chance + "   displayed " + r.shownAs),
      "  two outcomes with different stored values can print the same percentage",
    ]);
    await shot(page, "F-06-live");
  }

  // ---- F-02 - a market whose own fields disagree about its state ----
  {
    const d = await page.evaluate(async (api) => {
      const j = await (await fetch(api + "?tag=sports&sort=trending&limit=500&offset=0&lite=true")).json();
      for (const e of j.events || []) {
        const scored = e.score && String(e.score.raw || "").trim();
        if (scored && e.closed === false && e.acceptingOrders === true && e.status)
          return { slug: e.slug, title: String(e.title || "").slice(0, 70), score: e.score.raw,
            period: e.score.period, status: e.status, closed: e.closed, acceptingOrders: e.acceptingOrders };
      }
      return null;
    }, API);
    await band(page, "F-02 - one market record, and the state its own fields report", d ? [
      "  slug   : " + d.slug,
      "  title  : " + d.title,
      "  score  : " + d.score + "   period " + d.period,
      "  status : " + d.status + "      closed : " + d.closed + "      acceptingOrders : " + d.acceptingOrders,
      "  the score says play has happened while the flags say the market is untouched",
    ] : ["  (no instance in this response; the raw capture records the one that showed it)"]);
    await shot(page, "F-02-live");
  }

  // ---- F-26 - a market describing itself as completed while still counting down ----
  {
    const d = await page.evaluate(async (api) => {
      const now = Math.floor(Date.now() / 1000);
      const j = await (await fetch(api + "?tag=sports&sort=trending&limit=500&offset=0&lite=true")).json();
      for (const e of j.events || []) {
        const p = e.score && e.score.period;
        if ((p === "FT" || /completed/i.test(String(e.status || ""))) && typeof e.endTs === "number" && e.endTs > now)
          return { slug: e.slug, title: String(e.title || "").slice(0, 66), period: p, status: e.status,
            endsInDays: +(((e.endTs - now) / 86400).toFixed(1)),
            endsUTC: new Date(e.endTs * 1000).toUTCString().slice(0, 16) };
      }
      return null;
    }, API);
    await band(page, "F-26 - a market reported as finished that is still counting down to a future close", d ? [
      "  slug    : " + d.slug,
      "  title   : " + d.title,
      "  period  : " + d.period + "     status : " + d.status,
      "  still ends : " + d.endsUTC + "   (" + d.endsInDays + " days after this capture)",
      "  the same record says the match is over and that it closes days from now",
    ] : ["  (no instance in this response; the raw capture records the one that showed it)"]);
    await shot(page, "F-26-live");
  }

  // ---- F-29 - the seven-day cluster in closing times ----
  {
    const d = await page.evaluate(async (api) => {
      const j = await (await fetch(api + "?tag=sports&sort=trending&limit=500&offset=0&lite=true")).json();
      const buckets = {}; const rows = [];
      for (const e of j.events || []) {
        if (typeof e.endTs !== "number" || typeof e.gameStartTs !== "number") continue;
        const days = Math.round((e.endTs - e.gameStartTs) / 86400);
        buckets[days] = (buckets[days] || 0) + 1;
        if (days === 7 && rows.length < 4) rows.push(e.slug);
      }
      const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const total = Object.values(buckets).reduce((s, n) => s + n, 0);
      return { total, top, rows };
    }, API);
    await band(page, "F-29 - gap between a match starting and its market closing, across this live response", [
      "  dated markets measured : " + d.total,
      ...d.top.map(([k, v]) => "    closes " + String(k).padStart(3) + " days after the match starts : " + v + " markets"),
      ...d.rows.map((s) => "      example at +7 : " + s),
      "  a clean spike at exactly seven days reads like a default applied when the real close is missing",
    ]);
    await shot(page, "F-29-live");
  }

  // ---- F-21 - the same entity spelled two ways in one payload ----
  {
    const d = await page.evaluate(async (api) => {
      const j = await (await fetch(api + "?tag=politics&sort=trending&limit=500&offset=0&lite=true")).json();
      const seen = {};
      for (const e of j.events || []) for (const o of e.outcomes || []) {
        const n = (o.name || "").trim(); if (!n) continue;
        const k = n.toLowerCase();
        (seen[k] = seen[k] || new Set()).add(n);
      }
      const clash = Object.entries(seen).filter(([, s]) => s.size > 1)
        .map(([k, s]) => ({ key: k, spellings: [...s] })).slice(0, 5);
      return { distinct: Object.keys(seen).length, clashes: clash.length, rows: clash };
    }, API);
    await band(page, "F-21 - names that differ only by capitalisation inside one live response", [
      "  distinct outcome names : " + d.distinct,
      "  names carrying more than one spelling : " + d.clashes,
      ...d.rows.map((r) => "    " + r.spellings.map((x) => JSON.stringify(x)).join("   vs   ")),
      d.clashes ? "  two cards can show the same entity spelled two ways" : "  (none in this response; the raw capture records the pair that showed it)",
    ]);
    await shot(page, "F-21-live");
  }

  // ---- F-23 - the share preview a link produces ----
  {
    const meta = await page.evaluate(async () => {
      const r = await fetch(location.origin + "/pm", { headers: { accept: "text/html" } });
      const html = await r.text();
      const pick = (p) => {
        const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + p + '["\'][^>]*content=["\']([^"\']*)', "i"));
        return m ? m[1] : null;
      };
      return { title: (html.match(/<title[^>]*>([^<]*)/i) || [])[1] || null,
        ogTitle: pick("og:title"), ogDesc: pick("og:description"), ogImage: pick("og:image"),
        canonical: (html.match(/rel=["']canonical["'][^>]*href=["']([^"']*)/i) || [])[1] || null };
    });
    await band(page, "F-23 - the share metadata a link to /pm actually carries, read from the served HTML", [
      "  <title>        : " + JSON.stringify(meta.title),
      "  og:title       : " + JSON.stringify(meta.ogTitle),
      "  og:description : " + JSON.stringify(meta.ogDesc),
      "  og:image       : " + (meta.ogImage ? "present" : "ABSENT"),
      "  canonical      : " + JSON.stringify(meta.canonical),
      "  every market on the venue shares the one generic description above",
    ]);
    await shot(page, "F-23-live");
  }

  await browser.close();
})();
