const https=require("https");
https.request({host:"app.manic.trade",path:"/pm/event/atp-faria-alcaraz-2026-09-02",
 method:"GET",headers:{"User-Agent":"manic-bounty-scan/1.0"}},(res)=>{
  const raw=[]; res.on("data",c=>raw.push(c));
  res.on("end",()=>{
    const s=Buffer.concat(raw).toString("utf8");
    const at=(re)=>{const m=s.match(re);return m?s.indexOf(m[0]):-1;};
    console.log("total document bytes :",s.length);
    console.log("<head> at            :",at(/<head>/));
    console.log("<title> at           :",at(/<title>/));
    console.log("og:description at    :",at(/og:description/));
    console.log("rel=canonical at     :",at(/rel="canonical"/));
    console.log("</head> at           :",at(/<\/head>/));
    console.log("<body at             :",at(/<body/));
    console.log("<main at             :",at(/<main[ >]/));
    console.log("<h1 at               :",at(/<h1[ >]/));
    console.log();
    console.log("bytes before <title> :",at(/<title>/));
    console.log("that is",(100*at(/<title>/)/s.length).toFixed(1)+"% of the document");
  });
}).end();
