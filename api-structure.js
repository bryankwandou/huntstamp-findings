// Structural completeness of each event object: does it carry the pieces the UI
// needs to render and price it? Read-only, same public endpoint.
//
//   node api-structure.js

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
const F = {}; const add = (id,s) => (F[id]=F[id]||[]).push(s);

(async () => {
  const seen = new Set(); let events = 0;
  for (const tag of TAGS) for (const offset of [0,500,1000]) {
    const j = await get(`/charts/pm/events?tag=${tag}&sort=trending&limit=500&offset=${offset}&lite=true`);
    for (const ev of (j && j.events) || []) {
      if (seen.has(ev.id)) continue; seen.add(ev.id); events++;
      const oc = ev.outcomes || [];
      if (oc.length === 0) add("C1-no-outcomes", { slug: ev.slug, title: ev.title, status: ev.status });
      if (typeof ev.outcomesTotal === "number" && ev.outcomesTotal !== oc.length && oc.length > 0 && ev.outcomesTotal < oc.length)
        add("C2-count-mismatch", { slug: ev.slug, outcomesTotal: ev.outcomesTotal, actual: oc.length });
      if (!ev.title || !String(ev.title).trim()) add("C3-no-title", { slug: ev.slug, id: ev.id });
      if (!ev.slug) add("C4-no-slug", { id: ev.id, title: ev.title });
      // Duplicate outcome names within one event.
      const names = {}; oc.forEach((o) => { const n=(o.name||"").trim(); if(n) names[n]=(names[n]||0)+1; });
      Object.entries(names).filter(([,n])=>n>1).forEach(([n,c]) => add("C5-dup-outcome-name", { slug: ev.slug, name: n, count: c }));
      // An outcome with no price fields at all while the event accepts orders.
      oc.forEach((o) => {
        const noPrice = o.bestBid == null && o.bestAsk == null && o.chance == null && o.lastPrice == null;
        if (noPrice && o.acceptingOrders === true) add("C6-orderable-no-price", { slug: ev.slug, market: o.name });
      });
      // image / icon pointing off to a third-party host.
      if (ev.image && !/manic\.trade/.test(ev.image)) {
        try { add("C7-external-image-host", { host: new URL(ev.image).host }); } catch(e){}
      }
    }
    await new Promise((s)=>setTimeout(s,120));
  }
  // Collapse external-image hosts to counts.
  if (F["C7-external-image-host"]) {
    const h = {}; F["C7-external-image-host"].forEach((x)=>h[x.host]=(h[x.host]||0)+1);
    F["C7-external-image-host"] = Object.entries(h).map(([host,count])=>({host,count}));
  }
  const counts = Object.fromEntries(Object.entries(F).map(([k,v]) => [k, k==="C7-external-image-host" ? v.reduce((s,x)=>s+x.count,0) : v.length]));
  fs.writeFileSync("api-structure.json", JSON.stringify({ scannedAt:new Date().toISOString(),
    distinctEvents: events, counts, samples: Object.fromEntries(Object.entries(F).map(([k,v])=>[k,v.slice(0,8)])) }, null, 2));
  console.log(`\n=== ${events} events ===`);
  Object.entries(counts).forEach(([k,c]) => console.log(`  ${String(c).padStart(5)}  ${k}`));
  console.log("written: api-structure.json");
})();
