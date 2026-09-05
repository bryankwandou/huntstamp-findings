// What the pages other than the market directory actually call, and whether
// those responses hold together. Read-only: the browser loads each route and
// every request it makes is recorded, then the JSON ones are re-fetched and
// checked for the same kinds of contradiction the events API was checked for.
//
//   node probe-pages.js

const { chromium } = require("playwright");
const fs = require("fs");

const APP = "https://app.manic.trade";
const ROUTES = ["/leaderboard", "/referral", "/pm/updown/btc-5m", "/"];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const report = {};

  for (const route of ROUTES) {
    const calls = [];
    const onResp = (r) => {
      const u = r.url();
      if (/bo-server-api|\/api\//.test(u) && !/\.(png|jpg|svg|woff2?|css|js)(\?|$)/.test(u))
        calls.push({ url: u, status: r.status(), type: (r.headers()["content-type"] || "").split(";")[0] });
    };
    page.on("response", onResp);
    await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(8000);
    page.off("response", onResp);

    // De-duplicate by path so a polled endpoint is listed once.
    const seen = new Set();
    const uniq = calls.filter((c) => {
      const k = c.url.split("?")[0];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Re-fetch each JSON endpoint from inside the page and look at its shape.
    const bodies = [];
    for (const c of uniq.filter((x) => x.type.includes("json")).slice(0, 8)) {
      const info = await page.evaluate(async (u) => {
        try {
          const r = await fetch(u);
          const t = await r.text();
          let j = null;
          try { j = JSON.parse(t); } catch (e) {}
          const top = j && typeof j === "object" ? Object.keys(j).slice(0, 12) : null;
          const arr = j && Array.isArray(j) ? j.length
            : (j && typeof j === "object"
              ? Object.entries(j).filter(([, v]) => Array.isArray(v)).map(([k, v]) => k + "[" + v.length + "]")
              : null);
          return { status: r.status, bytes: t.length, topKeys: top, arrays: arr,
            total: j && j.total, count: j && j.count, hasMore: j && j.hasMore };
        } catch (e) { return { error: String(e) }; }
      }, c.url);
      bodies.push({ url: c.url, ...info });
    }

    report[route] = { jsonEndpointsCalled: uniq.length, endpoints: uniq, sampled: bodies };
    console.log(`\n${route}  — ${uniq.length} data endpoints`);
    for (const c of uniq) console.log(`   ${c.status}  ${c.type.padEnd(18)} ${c.url.replace(/^https?:\/\//, "").slice(0, 96)}`);
    for (const bdy of bodies) {
      const flags = [];
      if (typeof bdy.total === "number" && typeof bdy.count === "number" && bdy.total < bdy.count) flags.push("total<count");
      if (bdy.hasMore === false && typeof bdy.total === "number" && bdy.arrays)
        flags.push("hasMore=false total=" + bdy.total);
      console.log(`     body ${bdy.status} ${String(bdy.bytes).padStart(8)}b  arrays=${JSON.stringify(bdy.arrays)}` +
        (flags.length ? "  <-- " + flags.join(" ") : ""));
    }
  }

  fs.writeFileSync("probe-pages.json", JSON.stringify(report, null, 2));
  console.log("\nwritten: probe-pages.json");
  await b.close();
})();
