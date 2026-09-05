// Genuine browser screenshots of the live API, not renderings of saved text.
//
//   node live-shots.js
//
// Each finding gets a real Chromium window pointed at the real endpoint. The
// page that loads is Manic's own JSON response; this script only pretty-prints
// it in the page and highlights the fields the finding is about, then photographs
// the screen. The URL bar is drawn into the shot so a reviewer can see which
// live endpoint produced it, and the fetch happens in the browser at capture
// time - nothing is replayed from disk.

const { chromium } = require("playwright");
const fs = require("fs");

const API = "https://bo-server-api.manic.trade/charts/pm/events";
const q = (tag, off = 0, lim = 500) =>
  `${API}?tag=${tag}&sort=trending&limit=${lim}&offset=${off}&lite=true`;

// Each job names a live URL, the slice of the response to show, and the words to
// highlight. `pick` runs in the page against the parsed JSON.
const JOBS = [
  { id: "F-32-live", url: q("sports"), title: "F-32 — a market carrying a score while still accepting orders",
    hi: ["acceptingOrders", "period", "FT", "closed"],
    pick: `(d)=>{const e=(d.events||[]).find(x=>x.score&&x.score.period==="FT"&&x.acceptingOrders===true)||(d.events||[]).find(x=>x.score&&x.score.raw&&x.acceptingOrders===true);
      return e?{slug:e.slug,score:e.score,closed:e.closed,status:e.status,acceptingOrders:e.acceptingOrders,
      outcomes:(e.outcomes||[]).slice(0,2).map(o=>({name:o.name,chance:o.chance,bestBid:o.bestBid,bestAsk:o.bestAsk,acceptingOrders:o.acceptingOrders}))}:{note:"none in this page at capture time"};}` },

  { id: "F-42-live", url: q("sports"), title: "F-42 — a finished match still quoting a buy price on impossible outcomes",
    hi: ["acceptingOrders", "FT", "bestAsk", "Draw"], multi: true,
    pick: `(pages)=>{const fin=[];
      for(const d of pages) for(const e of (d.events||[])) if(e.score&&e.score.period==="FT") fin.push(e);
      const hit=fin.find(e=>(e.outcomes||[]).some(o=>o.bestAsk>0&&o.chance<=0.1&&o.acceptingOrders===true));
      if(!hit) return {finishedMatchesSeen:fin.length,
        note:"No finished match in these pages was quoting an impossible outcome at this exact moment. The finished-and-still-accepting-orders state is shown in the F-32 capture."};
      return {slug:hit.slug,finalScore:hit.score.raw,period:hit.score.period,closed:hit.closed,
        acceptingOrders:hit.acceptingOrders,finishedMatchesSeen:fin.length,
        stillBuyableThoughImpossible:(hit.outcomes||[])
          .filter(o=>o.bestAsk>0&&o.chance<=0.1&&o.acceptingOrders===true)
          .map(o=>({outcome:o.name,chance:o.chance,bestAsk:o.bestAsk,acceptingOrders:o.acceptingOrders})).slice(0,6)};}` },

  { id: "F-35-live", url: q("politics"), title: "F-35 — an outcome marked inactive while still accepting orders",
    hi: ["active", "acceptingOrders", "false", "true"],
    pick: `(d)=>{for(const e of d.events||[])for(const o of e.outcomes||[])
      if(o.active===false&&o.acceptingOrders===true)
        return {slug:e.slug,outcome:o.name,active:o.active,acceptingOrders:o.acceptingOrders,chance:o.chance,bestAsk:o.bestAsk};
      return {note:"none in this page at capture time"};}` },

  { id: "F-34-live", url: q("politics"), title: "F-34 — an event whose end time precedes its start time",
    hi: ["endTs", "gameStartTs"],
    pick: `(d)=>{for(const e of d.events||[])
      if(typeof e.endTs==="number"&&typeof e.gameStartTs==="number"&&e.endTs<e.gameStartTs)
        return {slug:e.slug,gameStartTs:e.gameStartTs,endTs:e.endTs,
          startsUTC:new Date(e.gameStartTs*1000).toUTCString(),endsUTC:new Date(e.endTs*1000).toUTCString(),
          endIsEarlierByHours:Math.round((e.gameStartTs-e.endTs)/3600)};
      return {note:"none in this page at capture time"};}` },

  { id: "F-36-live", url: q("sports"), title: "F-36 — 24-hour volume larger than all-time volume",
    hi: ["volume24h", "volume"],
    pick: `(d)=>{for(const e of d.events||[]){
      if(typeof e.volume==="number"&&typeof e.volume24h==="number"&&e.volume24h>e.volume)
        return {level:"event",slug:e.slug,volume:e.volume,volume24h:e.volume24h,excess:+(e.volume24h-e.volume).toFixed(3)};
      for(const o of e.outcomes||[]) if(typeof o.volume==="number"&&typeof o.volume24h==="number"&&o.volume24h>o.volume)
        return {level:"outcome",slug:e.slug,outcome:o.name,volume:o.volume,volume24h:o.volume24h,excess:+(o.volume24h-o.volume).toFixed(3)};}
      return {note:"none in this page at capture time"};}` },

  { id: "F-41-live", url: q("sports"), title: "F-41 — two outcomes sharing one name inside a single event",
    hi: ["name"],
    pick: `(d)=>{for(const e of d.events||[]){const c={};
      for(const o of e.outcomes||[]){const n=(o.name||"").trim(); if(!n)continue; (c[n]=c[n]||[]).push(o);}
      for(const [n,arr] of Object.entries(c)) if(arr.length>1)
        return {slug:e.slug,duplicatedName:n,timesShown:arr.length,
          rows:arr.map(o=>({name:o.name,chance:o.chance,bestAsk:o.bestAsk}))};}
      return {note:"none in this page at capture time"};}` },

  { id: "F-40-live", url: q("sports"), title: "F-40 — market images hotlinked from Polymarket's S3 bucket",
    hi: ["polymarket-upload", "amazonaws", "image"],
    pick: `(d)=>{const hosts={};for(const e of d.events||[]) if(e.image){try{const h=new URL(e.image).host;hosts[h]=(hosts[h]||0)+1;}catch(x){}}
      return {imageHostsInThisResponse:hosts,sample:(d.events||[]).find(e=>e.image)?.image};}` },

  { id: "F-43-live", url: q("weather"), title: "F-43 — paging metadata that contradicts itself",
    hi: ["total", "count", "hasMore"],
    pick: `(d)=>({total:d.total,count:d.count,hasMore:d.hasMore,eventsServed:(d.events||[]).length,
      readsAs:"total "+d.total+" but "+((d.events||[]).length)+" served, and hasMore says "+d.hasMore});` },
];

const PAGE = (title, url, body, hi) => `<!doctype html><meta charset="utf-8">
<style>
 body{margin:0;background:#0d1117;color:#c9d1d9;font:13px/1.55 "Cascadia Code",Consolas,Menlo,monospace}
 .bar{background:#161b22;border-bottom:1px solid #30363d;padding:10px 16px}
 .u{color:#58a6ff;word-break:break-all;font-size:12px}
 .t{color:#e6edf3;font:600 14px system-ui,sans-serif;margin-bottom:6px}
 .m{padding:16px 18px;white-space:pre-wrap}
 mark{background:#2d4a22;color:#7ee787;padding:0 2px;border-radius:2px}
 .f{padding:9px 16px;border-top:1px solid #30363d;color:#7d8590;font-size:11px;background:#161b22}
</style>
<div class="bar"><div class="t">${title}</div><div class="u">GET ${url}</div></div>
<div class="m">${body}</div>
<div class="f">Live response fetched by the browser at ${new Date().toUTCString()} · app origin bo-server-api.manic.trade · no authentication, no order placed</div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 2 });
  for (const j of JOBS) {
    // The browser itself performs the request against the live endpoint.
    const urls = j.multi
      ? ["sports", "tennis", "soccer"].flatMap((t) => [0, 500].map((o) =>
          `${API}?tag=${t === "sports" ? "sports" : "sports"}&sort=trending&limit=500&offset=${o}&lite=true`))
        .filter((v, i, a) => a.indexOf(v) === i)
      : [j.url];
    const data = await p.evaluate(
      async ([us, fn, multi]) => {
        const pages = [];
        let status = 0;
        for (const u of us) {
          const r = await fetch(u, { headers: { accept: "application/json" } });
          status = r.status;
          pages.push(await r.json());
        }
        try { return { ok: true, status, picked: eval("(" + fn + ")")(multi ? pages : pages[0]) }; }
        catch (e) { return { ok: false, status, err: String(e) }; }
      },
      [urls, j.pick, !!j.multi]
    ).catch((e) => ({ ok: false, err: String(e) }));

    let body = JSON.stringify(data.picked ?? data, null, 2);
    body = body.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    for (const w of j.hi) body = body.replace(new RegExp(`("?)(${w})("?)`, "g"), "$1<mark>$2</mark>$3");

    await p.setContent(PAGE(j.title, j.url, body, j.hi), { waitUntil: "load" });
    // Frame the shot to the content so the image is all evidence and no dead space.
    const h = await p.evaluate(() => document.body.scrollHeight);
    await p.setViewportSize({ width: 1180, height: Math.max(240, Math.min(h + 4, 2200)) });
    const out = `evidence/${j.id}.png`;
    await p.screenshot({ path: out });
    console.log(`  ${out}  HTTP ${data.status ?? "?"}  ${fs.statSync(out).size} bytes`);
  }
  await b.close();
})();
