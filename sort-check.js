// Does the "Ending Soon" sort surface markets that have already ended?
// Read-only.
const { chromium } = require("playwright");
const fs = require("fs");
const NAV = { waitUntil: "domcontentloaded", timeout: 120000 };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("https://app.manic.trade/pm", NAV);
  await p.waitForFunction(() => document.body.innerText.includes("Trending"), { timeout: 90000 });
  await p.waitForTimeout(6000);

  const out = { sorts: {} };
  for (const label of ["Ending Soon", "Newest", "Competitive", "Volume", "Liquidity"]) {
    try {
      await p.locator(`button:visible`, { hasText: new RegExp(`^${label}$`) }).first().click({ timeout: 15000 });
      await p.waitForTimeout(7000);
      out.sorts[label] = await p.evaluate(() => {
        const t = document.body.innerText;
        const pcts = (t.match(/\b(100(\.0)?|0)%/g) || []);
        return {
          cards: document.querySelectorAll('[class*="cursor-pointer"]').length,
          settledPrices: pcts.length,
          settledSample: [...new Set(pcts)],
          resolvedBadge: /Resolved|Market Ended/.test(t),
          firstCards: t.split("\n").filter(Boolean).slice(14, 26),
        };
      });
      await p.screenshot({ path: `evidence/F-19-sort-${label.replace(/\s+/g, "-").toLowerCase()}.png` });
    } catch (e) {
      out.sorts[label] = { error: String(e.message).split("\n")[0] };
    }
  }
  fs.writeFileSync("sort-check.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 2600));
  await b.close();
})();
