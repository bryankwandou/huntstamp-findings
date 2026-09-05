// Live screenshots for F-44 (stale sitemap entries served as 200) and F-45
// (directory-advertised ask disagreeing with the real order book). Same rule:
// a real browser, the live site or live API in frame, every number measured at
// capture time.
//
//   node page-shots4.js

const { chromium } = require("playwright");
const fs = require("fs");
const APP = "https://app.manic.trade";
const EVENTS = "https://bo-server-api.manic.trade/charts/pm/events";
const BOOK = "https://bo-server-api.manic.trade/charts/pm/book";

async function band(page, title, lines) {
  await page.evaluate(([t, ls]) => {
    document.querySelectorAll("#__eb").forEach((n) => n.remove());
    const d = document.createElement("div");
    d.id = "__eb";
    d.style.cssText = "position:fixed;inset:0 0 auto 0;z-index:2147483647;background:rgba(13,17,23,.96);" +
      "color:#c9d1d9;font:12.5px/1.6 Consolas,Menlo,monospace;padding:12px 16px;border-bottom:2px solid #58a6ff";
    const h = document.createElement("div");
    h.style.cssText = "font:600 14px system-ui,sans-serif;color:#e6edf3;margin-bottom:6px";
    h.textContent = t; d.appendChild(h);
    for (const l of ls) { const r = document.createElement("div"); r.style.whiteSpace = "pre-wrap"; r.textContent = l; d.appendChild(r); }
    document.documentElement.appendChild(d);
  }, [title, lines]);
}
const shot = async (page, id) => { const p = `evidence/${id}.png`; await page.screenshot({ path: p }); console.log(`  ${p}  ${fs.statSync(p).size} bytes`); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // ---- F-44 : a slug the site's own sitemap lists, no longer in the API, served as 200 ----
  const stale = "how-many-fed-rate-hikes-in-2026-20260623190717369";
  let resp = [];
  page.on("response", (r) => resp.push({ url: r.url(), status: r.status() }));
  await page.goto(APP + "/pm/event/" + stale, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(5000);
  {
    const r = resp.find((x) => x.url.includes(stale)) || {};
    const size = await page.evaluate(() => document.documentElement.outerHTML.length);
    const inApi = await page.evaluate(async ([api, slug]) => {
      for (const t of ["economy", "elections", "politics"]) {
        const j = await (await fetch(`${api}?tag=${t}&sort=trending&limit=500&offset=0&lite=true`)).json();
        if ((j.events || []).some((e) => e.slug === slug)) return true;
      }
      return false;
    }, [EVENTS, stale]);
    await band(page, "F-44 - a market the site's own sitemap.xml still lists, requested live", [
      "  slug (taken from https://app.manic.trade/sitemap.xml) :",
      "    " + stale,
      "  still present in the live events API : " + (inApi ? "yes" : "NO - the market is gone"),
      "  yet GET /pm/event/<slug> returns    : HTTP " + (r.status || "?") + "   " + size.toLocaleString() + " bytes",
      "  the sitemap feeds search engines a dead market dressed as a live page",
    ]);
    await shot(page, "F-44-live");
  }

  // ---- F-45 : directory-advertised ask vs the real order book ----
  await page.goto(APP + "/pm", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(6000);
  {
    const d = await page.evaluate(async ([events, book]) => {
      const bestAsk = (bk) => {
        const ps = (bk.asks || []).filter((x) => +x.size > 0).map((x) => +x.price);
        return ps.length ? Math.min(...ps) : null;
      };
      const out = [];
      let checked = 0;
      for (const t of ["sports", "crypto"]) {
        const j = await (await fetch(`${events}?tag=${t}&sort=trending&limit=500&offset=0&lite=true`)).json();
        for (const e of j.events || []) {
          for (const o of e.outcomes || []) {
            if (!(typeof o.bestAsk === "number" && o.bestAsk > 0 && o.bestAsk < 1 && o.tokenIdYes)) continue;
            const bk = await (await fetch(`${book}?token=${o.tokenIdYes}`)).json();
            const ba = bestAsk(bk);
            checked++;
            if (ba != null && Math.abs(ba - o.bestAsk) > 0.01)
              out.push({ slug: e.slug, market: o.name, dir: o.bestAsk, book: ba, gap: Math.round((ba - o.bestAsk) * 100) });
            if (out.length >= 6 || checked >= 60) break;
          }
          if (out.length >= 6 || checked >= 60) break;
        }
        if (out.length >= 6 || checked >= 60) break;
      }
      out.sort((a, c) => Math.abs(c.gap) - Math.abs(a.gap));
      return { checked, hits: out };
    }, [EVENTS, BOOK]);
    const lines = [
      "  outcomes cross-checked against /charts/pm/book at capture time : " + d.checked,
      "  where the directory ask differs from the real book by >1c      : " + d.hits.length + " (of the sample)",
    ];
    for (const h of d.hits.slice(0, 5))
      lines.push("    " + String(h.market).slice(0, 40).padEnd(40) + " listed " + h.dir.toFixed(3) + "  book " + h.book.toFixed(3) + "  " + (h.gap > 0 ? "+" : "") + h.gap + "c");
    lines.push("  the price on the card is not the price the order book would fill");
    await band(page, "F-45 - the ask shown in the directory vs the live order book behind it", lines);
    await shot(page, "F-45-live");
  }

  await b.close();
})();
