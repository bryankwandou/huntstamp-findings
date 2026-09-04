// What are the resources reporting zero transferred and zero decoded bytes?
// Cached responses report transferSize 0 but a non-zero decoded size, so both
// being zero needs explaining before it goes in a report.
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const responses = [];
  ctx.on("response", (r) => responses.push({ url: r.url(), status: r.status() }));
  const p = await ctx.newPage();
  await p.goto("https://app.manic.trade/pm", { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForFunction(() => document.body.innerText.includes("Trending"), { timeout: 90000 });
  await p.waitForTimeout(12000);

  const timing = await p.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => ({
      url: e.name, type: e.initiatorType,
      transfer: e.transferSize, decoded: e.decodedBodySize, encoded: e.encodedBodySize,
      duration: Math.round(e.duration),
    })));

  const zero = timing.filter((t) => t.transfer === 0 && t.decoded === 0);
  const byStatus = {};
  zero.forEach((z) => {
    const m = responses.find((r) => r.url === z.url);
    const s = m ? m.status : "no-response-event";
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  const out = {
    totalResources: timing.length,
    zeroSized: zero.length,
    zeroByHttpStatus: byStatus,
    zeroByInitiator: zero.reduce((a, z) => ((a[z.type] = (a[z.type] || 0) + 1), a), {}),
    sample: zero.slice(0, 14).map((z) => ({
      status: (responses.find((r) => r.url === z.url) || {}).status ?? null,
      type: z.type, ms: z.duration, url: z.url.replace("https://app.manic.trade", "").slice(0, 84),
    })),
    failedStatuses: responses.filter((r) => r.status >= 400)
      .map((r) => ({ status: r.status, url: r.url.slice(0, 90) })).slice(0, 15),
  };
  fs.writeFileSync("zero-check.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 2800));
  await b.close();
})();
