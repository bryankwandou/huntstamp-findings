// What does a link unfurler see if it stops reading after N bytes?
// Slack, Discord, Twitter and most crawlers cap the fetch. This measures at
// which cap the page title and description become visible at all.
const https=require("https");
const PATH="/pm/event/atp-faria-alcaraz-2026-09-02";
const CAPS=[65536,131072,262144,524288,1048576,1572864];

function fetchCapped(cap){
  return new Promise((resolve)=>{
    const req=https.request({host:"app.manic.trade",path:PATH,method:"GET",
      headers:{"User-Agent":"Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"}},(res)=>{
      let got=0; const parts=[];
      res.on("data",(c)=>{
        if(got>=cap){ req.destroy(); return; }
        const take=Math.min(c.length,cap-got); parts.push(c.subarray(0,take)); got+=take;
        if(got>=cap) req.destroy();
      });
      const done=()=>{
        const s=Buffer.concat(parts).toString("utf8");
        resolve({cap,bytesRead:got,
          title:(s.match(/<title>([^<]*)<\/title>/)||[])[1]||null,
          ogTitle:(s.match(/property="og:title" content="([^"]*)"/)||[])[1]||null,
          ogDesc:(s.match(/property="og:description" content="([^"]*)"/)||[])[1]||null,
          ogImage:(s.match(/property="og:image" content="([^"]*)"/)||[])[1]||null});
      };
      res.on("end",done); res.on("close",done); req.on("error",done);
    });
    req.on("error",()=>resolve({cap,bytesRead:0,title:null,ogTitle:null,ogDesc:null,ogImage:null}));
    req.end();
  });
}

(async()=>{
  console.log("A link unfurler reading only the first N bytes of");
  console.log("https://app.manic.trade" + PATH + "\n");
  console.log("  cap        read      title                        og:description");
  console.log("  " + "-".repeat(74));
  for(const c of CAPS){
    const r=await fetchCapped(c);
    console.log("  " + String(Math.round(c/1024)+"KB").padEnd(10) +
      String(Math.round(r.bytesRead/1024)+"KB").padEnd(9) +
      String(r.title?r.title.slice(0,26):"(none)").padEnd(29) +
      (r.ogDesc||"(none)"));
  }
})();
