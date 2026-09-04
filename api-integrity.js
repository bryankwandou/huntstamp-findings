// Pull the events API across every tag and check each market and each outcome
// for internal contradictions. Read-only: GET on the same public endpoint the
// site's own directory calls, no auth, no orders.
//
//   node api-integrity.js
//
// The API returns fields the UI never shows in one place - closed, active,
// acceptingOrders, bestBid, bestAsk, chance, endTs - so contradictions between
// them are invisible on screen but decide real behaviour: whether an order can
// be placed, and at what price. Every check below is a statement the data makes
// about itself that cannot be true.

const fs = require("fs");
const https = require("https");

const HOST = "bo-server-api.manic.trade";
const TAGS = ["sports","politics","elections","crypto","economy","finance","tech",
              "world","geopolitics","science","business","weather","pop-culture","pandemics"];
const LIMIT = 500;
const NOW = Math.floor(Date.now() / 1000);

function get(path) {
  return new Promise((resolve) => {
    const req = https.request({ host: HOST, path, headers: { "User-Agent": "manic-bounty-scan/1.0" } },
      (r) => { let b=""; r.setEncoding("utf8"); r.on("data",c=>b+=c);
        r.on("end",()=>{ try { resolve({status:r.statusCode, json:JSON.parse(b), bytes:b.length}); }
          catch(e){ resolve({status:r.statusCode, json:null, bytes:b.length}); } }); });
    req.on("error", () => resolve({ status: 0, json: null, bytes: 0 }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, json: null, bytes: 0 }); });
    req.end();
  });
}

const F = {};                    // finding id -> array of samples
function hit(id, sample) { (F[id] = F[id] || []).push(sample); }

function checkOutcome(ev, o) {
  const where = { slug: ev.slug, market: o.name || o.question, cond: o.conditionId };
  const bid = o.bestBid, ask = o.bestAsk, ch = o.chance, lp = o.lastPrice;

  // A book where the best bid is at or above the best ask is crossed: it says
  // someone will buy higher than someone else will sell, which cannot stand.
  if (typeof bid === "number" && typeof ask === "number" && bid > ask)
    hit("A1-crossed-book", { ...where, bestBid: bid, bestAsk: ask });

  // Prices are probabilities here; they must sit inside [0,1].
  for (const [k, v] of [["bestBid",bid],["bestAsk",ask],["chance",ch],["lastPrice",lp]])
    if (typeof v === "number" && (v < 0 || v > 1))
      hit("A2-price-out-of-range", { ...where, field: k, value: v });

  // Market flagged closed but still taking orders: an order placed here has no
  // open outcome to settle against.
  if (o.closed === true && o.acceptingOrders === true)
    hit("A3-closed-but-accepting", { ...where, closed: o.closed, acceptingOrders: o.acceptingOrders });

  // Inactive but still accepting orders.
  if (o.active === false && o.acceptingOrders === true)
    hit("A4-inactive-but-accepting", { ...where, active: o.active, acceptingOrders: o.acceptingOrders });

  // Same token id on both sides means Yes and No are indistinguishable on chain.
  if (o.tokenIdYes && o.tokenIdNo && o.tokenIdYes === o.tokenIdNo)
    hit("A5-identical-token-ids", { ...where, tokenId: o.tokenIdYes });

  // 24h volume cannot exceed all-time volume.
  if (typeof o.volume24h === "number" && typeof o.volume === "number" && o.volume24h > o.volume + 1e-6)
    hit("A6-24h-exceeds-total", { ...where, volume: o.volume, volume24h: o.volume24h });

  // Negative money.
  for (const [k, v] of [["volume",o.volume],["liquidity",o.liquidity],["volume24h",o.volume24h]])
    if (typeof v === "number" && v < 0)
      hit("A7-negative-money", { ...where, field: k, value: v });
}

function checkEvent(ev) {
  const where = { slug: ev.slug, title: ev.title };

  if (ev.closed === true && ev.acceptingOrders === true)
    hit("A8-event-closed-but-accepting", { ...where, closed: ev.closed, acceptingOrders: ev.acceptingOrders });

  // End timestamp already past, but the event still presents as open for orders.
  if (typeof ev.endTs === "number" && ev.endTs < NOW && ev.acceptingOrders === true && ev.closed === false)
    hit("A9-past-end-still-open", { ...where, endTs: ev.endTs,
        endedDaysAgo: +((NOW - ev.endTs) / 86400).toFixed(1), acceptingOrders: true });

  // A final score is set, yet the event is not closed.
  if (ev.score && String(ev.score).trim() && ev.closed === false && ev.acceptingOrders === true)
    hit("A10-scored-but-open", { ...where, score: ev.score });

  // endTs before the game even starts.
  if (typeof ev.endTs === "number" && typeof ev.gameStartTs === "number" && ev.endTs < ev.gameStartTs)
    hit("A11-ends-before-start", { ...where, gameStartTs: ev.gameStartTs, endTs: ev.endTs });

  // 24h volume beyond all-time, at event level.
  if (typeof ev.volume24h === "number" && typeof ev.volume === "number" && ev.volume24h > ev.volume + 1e-6)
    hit("A12-event-24h-exceeds-total", { ...where, volume: ev.volume, volume24h: ev.volume24h });

  // Duplicate conditionId within one event's outcomes: two markets that settle
  // as one.
  const conds = {};
  (ev.outcomes || []).forEach((o) => { if (o.conditionId) conds[o.conditionId] = (conds[o.conditionId]||0)+1; });
  Object.entries(conds).filter(([,n]) => n > 1).forEach(([c,n]) =>
    hit("A13-duplicate-condition-in-event", { ...where, conditionId: c, count: n }));

  (ev.outcomes || []).forEach((o) => checkOutcome(ev, o));
}

(async () => {
  const seen = new Set();
  let events = 0, outcomes = 0, apiBytes = 0, calls = 0;
  for (const tag of TAGS) {
    for (const offset of [0, 500, 1000]) {
      const r = await get(`/charts/pm/events?tag=${tag}&sort=trending&limit=${LIMIT}&offset=${offset}&lite=true`);
      calls++; apiBytes += r.bytes;
      const list = r.json && r.json.events || [];
      if (!list.length) continue;
      for (const ev of list) {
        if (seen.has(ev.id)) continue;      // events repeat across tags; count each once
        seen.add(ev.id);
        events++; outcomes += (ev.outcomes || []).length;
        checkEvent(ev);
      }
      await new Promise((s) => setTimeout(s, 120));
    }
    process.stdout.write(`  ${tag}: ${events} distinct events so far\n`);
  }

  const summary = {};
  for (const [id, arr] of Object.entries(F)) summary[id] = arr.length;

  const out = {
    scannedAt: new Date().toISOString(),
    now: NOW,
    apiCalls: calls,
    apiMB: +(apiBytes / 1048576).toFixed(1),
    distinctEvents: events,
    outcomesChecked: outcomes,
    counts: summary,
    samples: Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v.slice(0, 6)])),
  };
  fs.writeFileSync("api-integrity.json", JSON.stringify(out, null, 2));

  console.log(`\n=== ${events} events, ${outcomes} outcomes, ${(apiBytes/1048576).toFixed(1)} MB ===\n`);
  const labels = {
    "A1-crossed-book":"best bid >= best ask (crossed book)",
    "A2-price-out-of-range":"price outside [0,1]",
    "A3-closed-but-accepting":"outcome closed but still accepting orders",
    "A4-inactive-but-accepting":"outcome inactive but still accepting orders",
    "A5-identical-token-ids":"Yes and No share one token id",
    "A6-24h-exceeds-total":"outcome 24h volume > all-time volume",
    "A7-negative-money":"negative volume/liquidity",
    "A8-event-closed-but-accepting":"event closed but still accepting orders",
    "A9-past-end-still-open":"end time passed, event still open for orders",
    "A10-scored-but-open":"final score set, event still open",
    "A11-ends-before-start":"end time before game start",
    "A12-event-24h-exceeds-total":"event 24h volume > all-time volume",
    "A13-duplicate-condition-in-event":"duplicate conditionId within one event",
  };
  Object.keys(labels).forEach((id) =>
    console.log(`  ${String(summary[id]||0).padStart(5)}  ${id}  ${labels[id]}`));
  console.log("\nwritten: api-integrity.json");
})();
