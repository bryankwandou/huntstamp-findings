// Render each saved raw capture as a PNG, so findings whose evidence is a server
// response have an image to attach to the Typeform upload field.
//
//   node render-captures.js
//
// The image is a typeset rendering of the exact bytes in evidence/raw/*.txt.
// Nothing is edited, added or removed: the text file is published next to the
// image so a reviewer can diff one against the other, and each image carries the
// file name and capture date in its footer.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RAW = path.join(__dirname, "evidence", "raw");
const OUT = path.join(__dirname, "evidence");

const TITLES = {
  "F-19-headers": "F-19 · Security response headers absent from /pm",
  "F-20-soft404": "F-20 · Invented market slugs return HTTP 200, not 404",
  "F-21-case": "F-21 · Route matching is case-sensitive",
  "F-22-headings": "F-22 · No heading elements, and two <main> landmarks",
  "F-23-preview": "F-23 · Share preview says a settled market is still open",
  "F-24-404size": "F-24 · Every 404 ships 1.44 MB",
  "F-32-scored-but-open": "F-32 · Markets with a final score still accepting orders",
  "F-33-past-end-open": "F-33 · 338 markets past their end time, still open for orders",
  "F-34-ends-before-start": "F-34 · End time set before the game starts",
  "F-35-inactive-accepting": "F-35 · Outcomes inactive but still accepting orders",
  "F-36-volume-impossible": "F-36 · 24h volume larger than all-time volume",
  "F-37-no-securitytxt": "F-37 · No security.txt vulnerability-disclosure path",
  "F-38-manifest-favicon": "F-38 · manifest.json and favicon return a 1.5 MB HTML 404",
  "F-39-chance-vs-book": "F-39 · Displayed chance disagrees with the order book",
  "F-40-hotlinked-images": "F-40 · Every market image hotlinked from Polymarket S3",
  "F-41-dup-outcome-name": "F-41 · Two outcomes share one name in a single event",
  "F-02-contradictory-prices": "F-02 · One market, two price sets, one pair summing to 101%",
  "F-04-unpriced-outcome": "F-04 · An outcome with no price, and its order buttons still live",
  "F-06-percent-formatting": "F-06 · One value in thirty-five carries a decimal",
  "F-09-unused-preload": "F-09 · Landing-page assets preloaded on the trading route",
  "F-25-unfurl": "F-25 · Title and Open Graph tags arrive too late for link unfurlers",
  "F-26-completed": "F-26 · A market described as completed, priced at 50%, closing next week",
  "F-27-api-volume": "F-27 · 17.4 MB and 8,610 events downloaded to render 24 cards",
  "F-28-headings": "F-28 · Two <h1> elements on the referral page",
  "F-29-date-offset": "F-29 · A third of dated markets close exactly seven days late",
  "F-30-august": "F-30 · The August promotion still running in September",
  "F-31-unnamed": "F-31 · Four controls with no accessible name",
};

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function page(name, body) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `<!doctype html><meta charset="utf-8">
<style>
  :root{--bg:#0F1115;--panel:#161A21;--rule:#252B35;--ink:#E4E9F2;--dim:#7C8798;
        --accent:#5EC8B8;--hit:#F09A6A;--prompt:#87A9E8}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);font-family:"DejaVu Sans Mono","Cascadia Mono",Consolas,monospace}
  .card{margin:0;padding:28px 32px 22px}
  h1{font-family:"DejaVu Sans","Segoe UI",system-ui,sans-serif;font-size:16px;font-weight:600;
     color:var(--ink);margin:0 0 4px;letter-spacing:-.01em}
  .sub{font-size:11px;color:var(--dim);margin:0 0 18px;letter-spacing:.03em}
  pre{background:var(--panel);border:1px solid var(--rule);border-left:3px solid var(--accent);
      margin:0;padding:18px 20px;font-size:13px;line-height:1.65;color:var(--ink);
      white-space:pre-wrap;word-break:break-word}
  .p{color:var(--prompt)}
  .h{color:var(--hit);font-weight:700}
  footer{margin-top:14px;font-size:10.5px;color:var(--dim);line-height:1.7;
         border-top:1px solid var(--rule);padding-top:10px}
  footer b{color:var(--accent);font-weight:400}
</style>
<div class="card">
  <h1>${esc(TITLES[name] || name)}</h1>
  <p class="sub">app.manic.trade &middot; deployment dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce &middot; captured ${stamp} UTC</p>
  <pre>${body}</pre>
  <footer>
    Typeset rendering of the exact bytes in <b>evidence/raw/${name}.txt</b>, published alongside this image.<br>
    Nothing added, edited or removed. Re-run the command in the first line to reproduce.
  </footer>
</div>`;
}

/** Colour the shell prompt lines and the numbers that carry the finding. */
function highlight(text) {
  return esc(text)
    .split("\n")
    .map((line) => {
      if (line.startsWith("$ ") || line.startsWith("    curl") || line.startsWith("      https") || line.startsWith("  done"))
        return `<span class="p">${line}</span>`;
      return line
        .replace(/\b(200|404|1535\d{3}|1512170)\b/g, '<span class="h">$1</span>')
        .replace(/(count: 0|count: 2)/g, '<span class="h">$1</span>')
        .replace(/(Ends Sep 9|Ends Sep 11|\(none\)|Completed Match 50%)/g, '<span class="h">$1</span>')
        .replace(/(8,610|17\.4 MB|18,246,307|1,533,738|60 of 60|15 markets|359 to 1)/g, '<span class="h">$1</span>')
        .replace(/^(  absent|.*absent)$/gm, '<span class="h">$&</span>');
    })
    .join("\n");
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const p = await ctx.newPage();

  for (const file of fs.readdirSync(RAW).filter((f) => f.endsWith(".txt"))) {
    const name = file.replace(/\.txt$/, "");
    const text = fs.readFileSync(path.join(RAW, file), "utf8").replace(/\s+$/, "");
    await p.setViewportSize({ width: 900, height: 200 });
    await p.setContent(page(name, highlight(text)), { waitUntil: "load" });
    const h = await p.evaluate(() => document.querySelector(".card").getBoundingClientRect().height);
    await p.setViewportSize({ width: 900, height: Math.ceil(h) + 8 });
    const target = path.join(OUT, name + ".png");
    await p.screenshot({ path: target });
    console.log("  " + name + ".png  " + fs.statSync(target).size + " bytes");
  }
  await browser.close();
})();
