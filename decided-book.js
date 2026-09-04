// The money-path question, answered read-only: on markets whose result is
// already known, is the platform still publishing an executable quote?
//
//   node decided-book.js
//
// A "decided" market here is one the API itself marks finished - score.period
// FT, or a set score with the event still flagged live. For each such market
// this reads the top of book the API publishes (bestBid / bestAsk) on every
// outcome and classifies the exposure. It places NO orders and moves NO funds;
// it only reads the quotes Manic serves to a logged-out visitor. Whether an
// order against one of these quotes actually fills needs a funded account and
// is explicitly out of scope - this measures published executable exposure,
// not a completed trade.

const fs = require("fs");
const https = require("https");
const HOST = "bo-server-api.manic.trade";
const TAGS = ["sports","politics","elections","crypto","economy","finance","tech",
              "world","geopolitics","science","business","weather","pop-culture","pandemics"];

function get(path) {
  return new Promise((resolve) => {
    const req = https.request({ host: HOST, path, headers: { "User-Agent": "manic-bounty-scan/1.0" } },
      (r) => { let b=""; r.setEncoding("utf8"); r.on("data",c=>b+=c);
        r.on("end",()=>{ try { resolve(JSON.parse(b)); } catch(e){ resolve(null); } }); });
    req.on("error", () => resolve(null));
    req.setTimeout(60000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

const decided = (ev) => {
  const p = ev.score && ev.score.period;
  return p === "FT" || (ev.score && String(ev.score.raw || "").trim() && ev.acceptingOrders === true);
};

const F = { winnerBelowOne: [], loserHasAsk: [], anyBidOpen: [], askOnDecided: [] };

(async () => {
  const seen = new Set();
  let events = 0, decidedCount = 0, decidedAccepting = 0;
  for (const tag of TAGS) for (const offset of [0, 500, 1000]) {
    const j = await get(`/charts/pm/events?tag=${tag}&sort=trending&limit=500&offset=${offset}&lite=true`);
    for (const ev of (j && j.events) || []) {
      if (seen.has(ev.id)) continue; seen.add(ev.id); events++;
      if (!decided(ev)) continue;
      decidedCount++;
      if (ev.acceptingOrders === true) decidedAccepting++;

      for (const o of ev.outcomes || []) {
        const bid = o.bestBid, ask = o.bestAsk, ch = o.chance;
        const row = { slug: ev.slug, score: (ev.score||{}).raw, period: (ev.score||{}).period,
          market: o.name, chance: ch, bestBid: bid, bestAsk: ask,
          acceptingOrders: o.acceptingOrders };

        // The platform still shows an ask on a decided market: a buy price on a
        // known result.
        if (typeof ask === "number" && ask > 0 && ask < 1 && o.acceptingOrders === true)
          F.askOnDecided.push(row);

        // Winning side (chance near 1) still buyable below 1.0: pay < $1 for a
        // token that must redeem at $1.
        if (typeof ask === "number" && ask > 0 && ask < 0.99 && typeof ch === "number" && ch >= 0.9 && o.acceptingOrders === true)
          F.winnerBelowOne.push({ ...row, edgePerShare: +(1 - ask).toFixed(3) });

        // Losing side (chance near 0) still carries an ask: a buy price on a
        // token headed to $0.
        if (typeof ask === "number" && ask > 0 && typeof ch === "number" && ch <= 0.1 && o.acceptingOrders === true)
          F.loserHasAsk.push(row);

        // Any open bid on a decided market: a resting order to buy after the
        // result is in.
        if (typeof bid === "number" && bid > 0 && o.acceptingOrders === true)
          F.anyBidOpen.push(row);
      }
    }
    await new Promise((s)=>setTimeout(s,120));
  }

  const out = {
    scannedAt: new Date().toISOString(),
    distinctEvents: events,
    decidedMarkets: decidedCount,
    decidedStillAcceptingOrders: decidedAccepting,
    counts: {
      askQuotedOnDecidedOutcome: F.askOnDecided.length,
      winningSideBuyableBelowOne: F.winnerBelowOne.length,
      losingSideStillHasAsk: F.loserHasAsk.length,
      openBidOnDecidedOutcome: F.anyBidOpen.length,
    },
    samples: {
      winningSideBuyableBelowOne: F.winnerBelowOne.sort((a,b)=>b.edgePerShare-a.edgePerShare).slice(0,10),
      losingSideStillHasAsk: F.loserHasAsk.slice(0,10),
      askQuotedOnDecidedOutcome: F.askOnDecided.slice(0,10),
    },
  };
  fs.writeFileSync("decided-book.json", JSON.stringify(out, null, 2));
  console.log(`\n=== ${events} events, ${decidedCount} decided, ${decidedAccepting} decided AND still acceptingOrders ===\n`);
  console.log(`  ask quoted on a decided outcome        : ${out.counts.askQuotedOnDecidedOutcome}`);
  console.log(`  winning side buyable below $1.00       : ${out.counts.winningSideBuyableBelowOne}`);
  console.log(`  losing side still carrying an ask      : ${out.counts.losingSideStillHasAsk}`);
  console.log(`  open bid resting on a decided outcome  : ${out.counts.openBidOnDecidedOutcome}`);
  console.log("\n  top winning-side edges (pay < $1 for a token that redeems at $1):");
  out.samples.winningSideBuyableBelowOne.slice(0,6).forEach(r =>
    console.log(`    ${r.slug}  ${String(r.market).slice(0,42)}  chance ${r.chance}  ask ${r.bestAsk}  edge $${r.edgePerShare}/share`));
  console.log("\nwritten: decided-book.json");
})();
