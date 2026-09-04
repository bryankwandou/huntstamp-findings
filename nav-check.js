// Where does every primary navigation link actually go, and does it resolve?
// Read-only: link hrefs are read from the DOM and each is checked with a GET.
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("https://app.manic.trade/pm", { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForFunction(() => document.body.innerText.includes("Trending"), { timeout: 90000 });
  await p.waitForTimeout(10000);

  const links = await p.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .filter((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map((a) => ({
        text: (a.innerText || a.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40),
        href: a.getAttribute("href"),
        resolved: a.href,
      }))
      .filter((l) => l.href && !l.href.startsWith("#")));

  const uniq = [];
  const seen = new Set();
  for (const l of links) if (!seen.has(l.resolved)) { seen.add(l.resolved); uniq.push(l); }

  const results = [];
  for (const l of uniq) {
    if (!l.resolved.startsWith("https://app.manic.trade")) {
      results.push({ ...l, status: "external", note: "not checked" });
      continue;
    }
    const r = await p.request.get(l.resolved, { timeout: 45000, maxRedirects: 0 }).catch((e) => null);
    results.push({ ...l, status: r ? r.status() : "error" });
  }

  const broken = results.filter((r) => typeof r.status === "number" && r.status >= 400);
  const out = { checkedAt: new Date().toISOString(), totalVisibleLinks: links.length,
                distinct: uniq.length, broken: broken.length, brokenLinks: broken, all: results };
  fs.writeFileSync("nav-check.json", JSON.stringify(out, null, 2));
  console.log("visible links:", links.length, "distinct:", uniq.length, "broken:", broken.length);
  results.forEach((r) => console.log("  " + String(r.status).padEnd(9) + (r.text || "(no text)").padEnd(26) + " -> " + r.href));
  await b.close();
})();
