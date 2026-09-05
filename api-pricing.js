// Two unswept veins, read-only. (1) In a mutually-exclusive multi-outcome
// market the outcome probabilities should sum to about 1; a group summing far
// from 1 is a pricing error a trader can read straight off the screen.
// (2) Does the API's own paging and sorting hold together - are total/count/
// hasMore consistent, does offset actually advance, does sort=X actually sort?
//
//   node api-pricing.js

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

const F = { negRiskSum: [], groupSum: [], pageMeta: [], sortBroken: [], offsetDup: [] };

(async () => {
  const seen = new Set();
  let events = 0;

  for (const tag of TAGS) {
    // Pagination / sort integrity, measured on the first page of each tag.
    const p0 = await get(`/charts/pm/events?tag=${tag}&sort=trending&limit=500&offset=0&lite=true`);
    if (p0) {
      const list = p0.events || [];
      // count should match list length; total should be >= count; hasMore should
      // agree with whether total exceeds what has been served.
      if (typeof p0.count === "number" && p0.count !== list.length)
        F.pageMeta.push({ tag, field: "count!=events.length", count: p0.count, actual: list.length });
      if (typeof p0.total === "number" && typeof p0.count === "number" && p0.total < p0.count)
        F.pageMeta.push({ tag, field: "total<count", total: p0.total, count: p0.count });
      if (p0.hasMore === false && typeof p0.total === "number" && p0.total > list.length)
        F.pageMeta.push({ tag, field: "hasMore=false but total>served", total: p0.total, served: list.length });

      // Sort integrity: trending is opaque, but volume must be monotone.
      const vol = await get(`/charts/pm/events?tag=${tag}&sort=volume&limit=50&offset=0&lite=true`);
      if (vol && (vol.events || []).length > 2) {
        const vs = vol.events.map((e) => e.volume || 0);
        let inversions = 0;
        for (let i = 1; i < vs.length; i++) if (vs[i] > vs[i - 1] + 1e-6) inversions++;
        if (inversions > 0)
          F.sortBroken.push({ tag, sort: "volume", inversions, first5: vs.slice(0, 5).map((x) => Math.round(x)) });
      }

      // Offset integrity: page 2 should not repeat page-1 ids.
      const p1 = await get(`/charts/pm/events?tag=${tag}&sort=trending&limit=500&offset=500&lite=true`);
      if (p1 && (p1.events || []).length) {
        const ids0 = new Set(list.map((e) => e.id));
        const dup = (p1.events || []).filter((e) => ids0.has(e.id)).length;
        if (dup > 0) F.offsetDup.push({ tag, repeatedIds: dup, page2size: p1.events.length });
      }

      // Multi-outcome pricing sums.
      for (const ev of list) {
        if (seen.has(ev.id)) continue; seen.add(ev.id); events++;
        const oc = ev.outcomes || [];
        // Group outcomes by betGroup; a group of >2 mutually-exclusive outcomes
        // should have chances summing near 1.
        const groups = {};
        oc.forEach((o) => { const g = o.betGroup || o.marketType || "_"; (groups[g] = groups[g] || []).push(o); });
        for (const [g, arr] of Object.entries(groups)) {
          if (arr.length < 3) continue;
          const chances = arr.map((o) => o.chance).filter((c) => typeof c === "number");
          if (chances.length < 3) continue;
          const sum = chances.reduce((s, c) => s + c, 0);
          if (sum > 1.25 || sum < 0.75) {
            const rec = { slug: ev.slug, betGroup: g, outcomes: arr.length, sumChance: +sum.toFixed(3),
              negRisk: ev.negRisk };
            (ev.negRisk ? F.negRiskSum : F.groupSum).push(rec);
          }
        }
      }
    }
    await new Promise((s) => setTimeout(s, 150));
    process.stdout.write(`  ${tag}: ${events} events\n`);
  }

  const counts = {
    multiOutcomeSumFarFromOne_negRisk: F.negRiskSum.length,
    multiOutcomeSumFarFromOne_other: F.groupSum.length,
    paginationMetaInconsistent: F.pageMeta.length,
    volumeSortNotMonotone: F.sortBroken.length,
    offsetReturnsDuplicates: F.offsetDup.length,
  };
  fs.writeFileSync("api-pricing.json", JSON.stringify({ scannedAt: new Date().toISOString(),
    distinctEvents: events, counts,
    samples: { negRiskSum: F.negRiskSum.slice(0,8), groupSum: F.groupSum.slice(0,8),
      pageMeta: F.pageMeta.slice(0,8), sortBroken: F.sortBroken.slice(0,8), offsetDup: F.offsetDup.slice(0,8) } }, null, 2));
  console.log(`\n=== ${events} events ===`);
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
  console.log("\n  negRisk sum samples:");
  F.negRiskSum.slice(0,6).forEach((r) => console.log(`    ${r.slug}  ${String(r.betGroup).slice(0,30)}  n=${r.outcomes}  sum=${r.sumChance}`));
  console.log("  volume-sort samples:");
  F.sortBroken.slice(0,4).forEach((r) => console.log(`    ${r.tag}  inversions=${r.inversions}  first5=${r.first5}`));
  console.log("\nwritten: api-pricing.json");
})();
