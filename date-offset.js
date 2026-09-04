// Is the "Ends" date on a market always its match date plus seven days?
// Targets only event slugs that carry a date, so the sample is large enough
// to say something. Read-only GETs.
const fs=require("fs"), https=require("https");
const HOST="app.manic.trade", SAMPLE=45, DELAY=250, WORKERS=4;
const M={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};

const get=(path)=>new Promise((res)=>{
  const rq=https.request({host:HOST,path,headers:{"User-Agent":"manic-bounty-scan/1.0"}},(r)=>{
    let b=""; r.setEncoding("utf8"); r.on("data",c=>b+=c); r.on("end",()=>res({status:r.statusCode,body:b}));});
  rq.on("error",()=>res({status:0,body:""}));
  rq.setTimeout(60000,()=>{rq.destroy();res({status:0,body:""});});
  rq.end();
});

(async()=>{
  const sm=await get("/sitemap.xml");
  const dated=[...sm.body.matchAll(/<loc>([^<]*\/pm\/event\/[^<]*?(20\d\d-\d\d-\d\d))<\/loc>/g)]
    .map(m=>({url:m[1],date:m[2]}));
  console.log(`${dated.length} event URLs carry a date in the slug`);
  const step=Math.max(1,Math.floor(dated.length/SAMPLE));
  const pick=dated.filter((_,i)=>i%step===0).slice(0,SAMPLE);
  console.log(`sampling ${pick.length}\n`);

  const rows=[]; let n=0;
  async function work(list){
    for(const it of list){
      const path=new URL(it.url).pathname;
      const r=await get(path);
      const og=(r.body.match(/property="og:description" content="([^"]*)"/)||[])[1]||"";
      const ti=(r.body.match(/<title>([^<]*)<\/title>/)||[])[1]||"";
      const m=og.match(/Ends\s+([A-Z][a-z]{2})\s+(\d{1,2})/);
      let offset=null, ends=null;
      if(m){
        const sd=new Date(it.date+"T00:00:00Z");
        ends=new Date(Date.UTC(sd.getUTCFullYear(),M[m[1]]-1,+m[2]));
        offset=Math.round((ends-sd)/86400000);
      }
      rows.push({slug:path.split("/").pop(),slugDate:it.date,title:ti,ogDesc:og,
        endsDate:ends?ends.toISOString().slice(0,10):null,offsetDays:offset,
        saysCompleted:/Completed Match/.test(og)});
      if(++n%10===0) console.log(`  ${n}/${pick.length}`);
      await new Promise(r2=>setTimeout(r2,DELAY));
    }
  }
  const ch=Array.from({length:WORKERS},()=>[]);
  pick.forEach((u,i)=>ch[i%WORKERS].push(u));
  await Promise.all(ch.map(work));

  const withOffset=rows.filter(r=>r.offsetDays!==null);
  const counts={};
  withOffset.forEach(r=>counts[r.offsetDays]=(counts[r.offsetDays]||0)+1);
  const completed=rows.filter(r=>r.saysCompleted);
  const out={checkedAt:new Date().toISOString(),datedUrlsInSitemap:dated.length,
    sampled:pick.length,withEndsDate:withOffset.length,offsetDistribution:counts,
    allSevenDays:Object.keys(counts).length===1&&counts["7"]===withOffset.length,
    completedButOpen:completed.length,
    completedSample:completed.slice(0,8).map(r=>({slug:r.slug,ogDesc:r.ogDesc})),
    rows};
  fs.writeFileSync("date-offset.json",JSON.stringify(out,null,2));
  console.log("\n=== offset distribution (Ends minus slug date) ===");
  Object.keys(counts).sort((a,b)=>a-b).forEach(k=>console.log(`  ${String(k).padStart(4)} days : ${counts[k]}`));
  console.log(`\n  pages with an Ends date : ${withOffset.length}/${pick.length}`);
  console.log(`  every one exactly +7    : ${out.allSevenDays}`);
  console.log(`  "Completed Match" but still advertising a future close : ${completed.length}`);
  completed.slice(0,6).forEach(r=>console.log(`    ${r.slug.padEnd(34)} ${r.ogDesc.slice(0,72)}`));
})();
