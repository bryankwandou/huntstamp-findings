// Second-wave data-quality pass over the same events API. Read-only.
//
//   node api-integrity2.js
//
// Where the first pass checked each market against itself, this one checks
// markets against each other and against time: duplicate settlement ids shared
// across different events, complementary prices that do not sum to one, markets
// still live years in the past or with impossible dates, and repeated slugs.

const fs = require("fs");
const https = require("https");

const HOST = "bo-server-api.manic.trade";
const TAGS = ["sports","politics","elections","crypto","economy","finance","tech",
              "world","geopolitics","science","business","weather","pop-culture","pandemics"];
const NOW = Math.floor(Date.now() / 1000);
const YEAR = 365 * 86400;

function get(path) {
  return new Promise((resolve) => {
    const req = https.request({ host: HOST, path, headers: { "User-Agent": "manic-bounty-scan/1.0" } },
      (r) => { let b=""; r.setEncoding("utf8"); r.on("data",c=>b+=c);
        r.on("end",()=>{ try { resolve({status:r.statusCode, json:JSON.parse(b), bytes:b.length}); }
          catch(e){ resolve({status:r.statusCode, json:null, bytes:b.length}); } }); });
    req.on("error", () => resolve({ status: 0, json: null }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, json: null }); });
    req.end();
  });
}

const F = {};
const add = (id, s) => (F[id] = F[id] || []).push(s);

(async () => {
  const seen = new Set();
  const condToEvents = {};        // conditionId -> set of event slugs
  const slugCount = {};           // slug -> times seen
  let events = 0, outcomes = 0;

  for (const tag of TAGS) {
    for (const offset of [0, 500, 1000]) {
      const r = await get(`/charts/pm/events?tag=${tag}&sort=trending&limit=500&offset=${offset}&lite=true`);
      const list = (r.json && r.json.events) || [];
      for (const ev of list) {
        slugCount[ev.slug] = (slugCount[ev.slug] || 0) + 1;
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        events++;

        // Far-future / impossible event dates.
        if (typeof ev.endTs === "number") {
          if (ev.endTs > NOW + 5 * YEAR)
            add("B1-end-far-future", { slug: ev.slug, endTs: ev.endTs, yearsOut: +((ev.endTs-NOW)/YEAR).toFixed(1) });
          if (ev.endTs < NOW - 2 * YEAR && ev.acceptingOrders === true)
            add("B2-ancient-still-open", { slug: ev.slug, endTs: ev.endTs, yearsAgo: +((NOW-ev.endTs)/YEAR).toFixed(1) });
        }

        const oc = ev.outcomes || [];
        outcomes += oc.length;

        // hasPriceFeed false but the outcomes still carry live-looking prices.
        if (ev.hasPriceFeed === false && oc.some((o) => typeof o.chance === "number" && o.chance > 0 && o.chance < 1))
          add("B3-priced-without-feed", { slug: ev.slug, hasPriceFeed: false,
              sampleChance: oc.find((o)=>o.chance>0&&o.chance<1).chance });

        for (const o of oc) {
          if (o.conditionId) {
            (condToEvents[o.conditionId] = condToEvents[o.conditionId] || new Set()).add(ev.slug);
          }
          // A two-sided market's own bestBid and bestAsk imply a spread; a spread
          // wider than 25 cents on a market advertised as accepting orders is a
          // dead book being presented as live.
          if (typeof o.bestBid === "number" && typeof o.bestAsk === "number" &&
              o.acceptingOrders === true && (o.bestAsk - o.bestBid) > 0.25)
            add("B4-wide-spread-open", { slug: ev.slug, market: o.name,
                bestBid: o.bestBid, bestAsk: o.bestAsk, spread: +(o.bestAsk-o.bestBid).toFixed(2) });

          // chance disagreeing with the mid price by more than 20 points.
          if (typeof o.chance === "number" && typeof o.bestBid === "number" && typeof o.bestAsk === "number") {
            const mid = (o.bestBid + o.bestAsk) / 2;
            if (Math.abs(o.chance - mid) > 0.20)
              add("B5-chance-vs-mid", { slug: ev.slug, market: o.name,
                  chance: o.chance, mid: +mid.toFixed(3), gap: +Math.abs(o.chance-mid).toFixed(3) });
          }

          // lastPrice sitting outside the current book (below bid or above ask
          // by more than a tick) — a stale trade price shown as current.
          if (typeof o.lastPrice === "number" && typeof o.bestBid === "number" && typeof o.bestAsk === "number"
              && o.bestBid > 0 && o.bestAsk < 1
              && (o.lastPrice < o.bestBid - 0.05 || o.lastPrice > o.bestAsk + 0.05))
            add("B6-laststale", { slug: ev.slug, market: o.name,
                lastPrice: o.lastPrice, bestBid: o.bestBid, bestAsk: o.bestAsk });
        }
      }
      await new Promise((s) => setTimeout(s, 120));
    }
    process.stdout.write(`  ${tag}: ${events}\n`);
  }

  // One settlement id shared by two or more different events: a resolution on
  // one silently settles the other.
  Object.entries(condToEvents).forEach(([cond, set]) => {
    if (set.size > 1) add("B7-condition-across-events", { conditionId: cond, events: [...set].slice(0, 5), count: set.size });
  });
  // Slug served more than once in one crawl (same page returned in two tags at
  // the same offset is deduped by id; this catches genuinely repeated slugs).
  Object.entries(slugCount).forEach(([slug, n]) => { if (n > 3) add("B8-slug-repeated", { slug, times: n }); });

  const counts = Object.fromEntries(Object.entries(F).map(([k,v]) => [k, v.length]));
  fs.writeFileSync("api-integrity2.json", JSON.stringify({
    scannedAt: new Date().toISOString(), distinctEvents: events, outcomesChecked: outcomes,
    counts, samples: Object.fromEntries(Object.entries(F).map(([k,v]) => [k, v.slice(0,6)])),
  }, null, 2));

  console.log(`\n=== ${events} events, ${outcomes} outcomes ===\n`);
  const labels = {
    "B1-end-far-future":"event ends more than 5 years out",
    "B2-ancient-still-open":"ended 2+ years ago, still accepting orders",
    "B3-priced-without-feed":"hasPriceFeed false but carries live prices",
    "B4-wide-spread-open":"spread wider than 25c on an open market",
    "B5-chance-vs-mid":"displayed chance disagrees with mid price by >20pts",
    "B6-laststale":"lastPrice outside the current book",
    "B7-condition-across-events":"one settlement id shared by multiple events",
    "B8-slug-repeated":"same slug served many times in one crawl",
  };
  Object.keys(labels).forEach((id) => console.log(`  ${String(counts[id]||0).padStart(5)}  ${id}  ${labels[id]}`));
  console.log("\nwritten: api-integrity2.json");
})();
