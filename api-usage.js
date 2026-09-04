// How much data does the market directory request to render its first screen?
// Read-only observation of the network the page makes on its own.
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const calls = [];
  ctx.on("response", async (r) => {
    const u = r.url();
    if (!/bo-server-api\.manic\.trade|\/api\//.test(u)) return;
    let bytes = null, items = null;
    try {
      const buf = await r.body();
      bytes = buf.length;
      try {
        const j = JSON.parse(buf.toString("utf8"));
        const arr = Array.isArray(j) ? j : (j.data || j.events || j.results || null);
        if (Array.isArray(arr)) items = arr.length;
      } catch {}
    } catch {}
    calls.push({ url: u, status: r.status(), bytes, items });
  });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto("https://app.manic.trade/pm", { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForFunction(() => document.body.innerText.includes("Trending"), { timeout: 90000 });
  await p.waitForTimeout(15000);
  const cardsShown = await p.evaluate(() => document.querySelectorAll('[class*="cursor-pointer"]').length);

  const tagCalls = calls.filter((c) => /[?&]tag=/.test(c.url));
  const tags = [...new Set(tagCalls.map((c) => (c.url.match(/[?&]tag=([^&]+)/) || [])[1]))];
  const limit500 = calls.filter((c) => /limit=500/.test(c.url));
  const totalBytes = calls.reduce((s, c) => s + (c.bytes || 0), 0);
  const totalItems = calls.reduce((s, c) => s + (c.items || 0), 0);

  const out = {
    wallClockMs: Date.now() - t0,
    apiCalls: calls.length,
    tagQueries: tagCalls.length,
    distinctTags: tags,
    callsRequestingLimit500: limit500.length,
    totalApiBytes: totalBytes,
    totalApiBytesMB: +(totalBytes / 1048576).toFixed(2),
    totalItemsReturned: totalItems,
    cardsActuallyRendered: cardsShown,
    biggest: calls.slice().sort((a, c) => (c.bytes || 0) - (a.bytes || 0)).slice(0, 8)
      .map((c) => ({ bytes: c.bytes, items: c.items, url: c.url.replace("https://bo-server-api.manic.trade", "").slice(0, 80) })),
  };
  fs.writeFileSync("api-usage.json", JSON.stringify({ summary: out, calls }, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
