// Does sorting by Liquidity really return a near-empty grid, or was the first
// sample taken before the grid finished loading? Waits far longer, samples
// repeatedly, and re-tests in both directions. Read-only.
const { chromium } = require("playwright");
const fs = require("fs");
const NAV = { waitUntil: "domcontentloaded", timeout: 120000 };

const count = (p) =>
  p.evaluate(() => ({
    cards: document.querySelectorAll('[class*="cursor-pointer"]').length,
    textLen: document.body.innerText.length,
    empty: /no markets|no results/i.test(document.body.innerText),
  }));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("https://app.manic.trade/pm", NAV);
  await p.waitForFunction(() => document.body.innerText.includes("Trending"), { timeout: 90000 });
  await p.waitForTimeout(8000);

  const out = { samples: {} };
  for (const label of ["Liquidity", "Volume", "Liquidity", "Trending", "Liquidity"]) {
    await p.locator("button:visible", { hasText: new RegExp(`^${label}$`) }).first()
      .click({ timeout: 20000 });
    const series = [];
    for (const wait of [3000, 5000, 7000, 10000, 15000]) {
      await p.waitForTimeout(wait);
      series.push({ afterMs: series.reduce((s, x) => s + x.waited, 0) + wait, waited: wait, ...(await count(p)) });
    }
    const key = label + "#" + (Object.keys(out.samples).filter((k) => k.startsWith(label)).length + 1);
    out.samples[key] = series;
    console.log(key, series.map((s) => s.cards).join(" -> "));
  }
  await p.locator("button:visible", { hasText: /^Liquidity$/ }).first().click({ timeout: 20000 });
  await p.waitForTimeout(25000);
  await p.screenshot({ path: "evidence/F-20-liquidity-sort.png" });
  out.finalLiquidity = await count(p);
  out.finalLiquidityText = await p.evaluate(() =>
    document.body.innerText.split("\n").filter(Boolean).slice(12, 30)
  );
  fs.writeFileSync("liquidity-check.json", JSON.stringify(out, null, 2));
  console.log("\nfinal:", JSON.stringify(out.finalLiquidity));
  console.log(out.finalLiquidityText.join(" | ").slice(0, 300));
  await b.close();
})();
