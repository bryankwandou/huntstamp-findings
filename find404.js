// Which requests return 4xx/5xx across the logged-out routes?
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const bad = [];
  ctx.on("response", (r) => {
    if (r.status() >= 400) bad.push({ status: r.status(), url: r.url(), type: r.request().resourceType() });
  });
  const p = await ctx.newPage();
  for (const route of ["/", "/leaderboard", "/referral", "/pm"]) {
    await p.goto("https://app.manic.trade" + route, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(()=>{});
    await p.waitForTimeout(16000);
    console.log(route, "-> failures so far:", bad.length);
  }
  const uniq = [];
  const seen = new Set();
  for (const x of bad) if (!seen.has(x.url)) { seen.add(x.url); uniq.push(x); }
  fs.writeFileSync("find404.json", JSON.stringify({ total: bad.length, distinct: uniq }, null, 2));
  console.log("\ndistinct failing requests:", uniq.length);
  uniq.forEach((x) => console.log("  " + x.status + "  " + x.type.padEnd(10) + x.url.slice(0, 110)));
  await b.close();
})();
