// Severe checks against the REAL order book, read-only. No orders, no funds.
//
//   node book-arb.js
//
// In a binary market YES and NO are separate tokens, and one share of each
// always redeems to exactly $1 (one side wins, the other goes to zero). So:
//   - if best_ask(YES) + best_ask(NO) < 1, a buyer of both locks in the
//     difference risk-free, paid out of the venue - a standing arbitrage.
//   - a single book whose best bid >= best ask has crossed: the matching
//     engine should already have filled those orders against each other.
//   - any price outside (0,1) is invalid for a probability contract.
// Every number here is read from /charts/pm/book; nothing is placed.

const fs = require("fs");
const https = require("https");
const HOSTE = "bo-server-api.manic.trade";

function get(path) {
  return new Promise((resolve) => {
    const req = https.request({ host: HOSTE, path, headers: { "User-Agent": "manic-bounty-scan/1.0" } },
      (r) => { let b = ""; r.setEncoding("utf8"); r.on("data", (c) => b += c);
        r.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { resolve(null); } }); });
    req.on("error", () => resolve(null));
    req.setTimeout(45000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}
const book = (tok) => get(`/charts/pm/book?token=${tok}`);
const evs = (tag, off) => get(`/charts/pm/events?tag=${tag}&sort=trending&limit=500&offset=${off}&lite=true`);

const nums = (side) => (side || []).filter((x) => +x.size > 0).map((x) => +x.price);
const bestAsk = (b) => { const p = nums(b.asks); return p.length ? Math.min(...p) : null; };
const bestBid = (b) => { const p = nums(b.bids); return p.length ? Math.max(...p) : null; };
const depthAt = (side, price) => (side || []).filter((x) => +x.price === price).reduce((s, x) => s + +x.size, 0);

const F = { arb: [], crossed: [], oob: [] };

(async () => {
  const tags = ["sports", "politics", "crypto", "tech", "world", "finance", "pop-culture", "economy"];
  const seen = new Set();
  let markets = 0, booksRead = 0;

  for (const tag of tags) {
    const d = await evs(tag, 0);
    for (const e of (d && d.events) || []) {
      if (seen.has(e.id)) continue; seen.add(e.id);
      for (const o of e.outcomes || []) {
        if (!o.tokenIdYes || !o.tokenIdNo) continue;
        markets++;
        const [by, bn] = [await book(o.tokenIdYes), await book(o.tokenIdNo)];
        if (!by || !bn) continue;
        booksRead += 2;

        // out of range and crossed, per token
        for (const [side, bk] of [["YES", by], ["NO", bn]]) {
          const ba = bestAsk(bk), bb = bestBid(bk);
          for (const p of [...nums(bk.asks), ...nums(bk.bids)])
            if (p <= 0 || p >= 1) { F.oob.push({ slug: e.slug, market: o.name, side, price: p }); break; }
          if (ba != null && bb != null && bb >= ba)
            F.crossed.push({ slug: e.slug, market: o.name, side, bestBid: bb, bestAsk: ba,
              bidSize: depthAt(bk.bids, bb), askSize: depthAt(bk.asks, ba) });
        }

        // YES/NO ask-sum arbitrage
        const ay = bestAsk(by), an = bestAsk(bn);
        if (ay != null && an != null) {
          const sum = ay + an;
          if (sum < 0.99) {
            F.arb.push({ slug: e.slug, market: o.name, askYES: ay, askNO: an, sum: +sum.toFixed(3),
              riskFreePerPair: +(1 - sum).toFixed(3),
              sizeYES: depthAt(by.asks, ay), sizeNO: depthAt(bn.asks, an) });
          }
        }
        await new Promise((s) => setTimeout(s, 40));
      }
      if (booksRead > 300) break;
    }
    if (booksRead > 300) break;
  }

  const out = {
    scannedAt: new Date().toISOString(), marketsSeen: markets, booksRead,
    counts: { yesNoAskSumBelow1: F.arb.length, crossedBooks: F.crossed.length, priceOutOfRange: F.oob.length },
    samples: {
      yesNoAskSumBelow1: F.arb.sort((a, b) => b.riskFreePerPair - a.riskFreePerPair).slice(0, 12),
      crossedBooks: F.crossed.slice(0, 10),
      priceOutOfRange: F.oob.slice(0, 10),
    },
  };
  fs.writeFileSync("book-arb.json", JSON.stringify(out, null, 2));
  console.log(`\n=== ${markets} outcomes, ${booksRead} books read ===`);
  console.log(`  YES+NO best-ask sum below $1 (risk-free buy) : ${F.arb.length}`);
  console.log(`  crossed books (bid >= ask)                   : ${F.crossed.length}`);
  console.log(`  price outside (0,1)                          : ${F.oob.length}`);
  console.log("\n  largest risk-free spreads:");
  out.samples.yesNoAskSumBelow1.slice(0, 8).forEach((a) =>
    console.log(`    ${a.slug.slice(0,30).padEnd(30)} ${String(a.market).slice(0,26).padEnd(26)} askYES ${a.askYES} + askNO ${a.askNO} = ${a.sum}  free $${a.riskFreePerPair}/pair  (sizes ${a.sizeYES}/${a.sizeNO})`));
  console.log("\nwritten: book-arb.json");
})();
