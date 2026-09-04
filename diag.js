const https = require("https");
const req = https.request({host:"app.manic.trade",path:"/pm/event/atp-faria-alcaraz-2026-09-02",
  method:"GET",headers:{"User-Agent":"manic-bounty-scan/1.0"}}, (res)=>{
  console.log("status:",res.statusCode);
  console.log("content-encoding:",res.headers["content-encoding"]||"(none)");
  console.log("content-type:",res.headers["content-type"]);
  console.log("content-length:",res.headers["content-length"]||"(chunked)");
  let raw=[],chars="";
  res.on("data",c=>{raw.push(c);});
  res.setEncoding && null;
  res.on("end",()=>{
    const buf=Buffer.concat(raw);
    console.log("raw bytes received:",buf.length);
    const head=buf.subarray(0,200);
    console.log("first bytes hex:",head.subarray(0,12).toString("hex"));
    console.log("looks like html:",buf.subarray(0,15).toString("utf8"));
    const s=buf.toString("utf8");
    console.log("has <title>:",/\<title\>/.test(s));
    console.log("title:",(s.match(/<title>([^<]*)<\/title>/)||[])[1]);
    console.log("has canonical:",/rel="canonical"/.test(s));
    console.log("has og:desc:",/og:description/.test(s));
  });
});
req.end();
