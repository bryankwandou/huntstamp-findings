// Second compression pass: bring every referenced image under a size that fits
// one deploy, without losing the legibility of any measured figure.
const { chromium } = require("playwright");
const fs = require("fs");
const map = JSON.parse(fs.readFileSync("evidence-map.json", "utf8"));
const used = new Set();
for (const v of Object.values(map)) if (Array.isArray(v)) for (const s of v) used.add(s.file);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  let before = 0, after = 0;
  for (const f of [...used]) {
    const src = "evidence/" + f;
    if (!fs.existsSync(src)) continue;
    const buf = fs.readFileSync(src);
    if (buf.length < 150 * 1024) { before += buf.length; after += buf.length; continue; }
    before += buf.length;
    const mime = f.endsWith(".png") ? "png" : "jpeg";
    const out = await p.evaluate(async ([d, mm]) => {
      const img = new Image();
      img.src = "data:image/" + mm + ";base64," + d;
      await img.decode();
      const scale = Math.min(1, 1450 / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const x = c.getContext("2d");
      x.fillStyle = "#0d1117";
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.82).split(",")[1];
    }, [buf.toString("base64"), mime]);
    const dst = src.replace(/\.(png|jpg)$/, ".jpg");
    fs.writeFileSync(dst, Buffer.from(out, "base64"));
    if (dst !== src) {
      // point the map at the new file
      for (const v of Object.values(map)) if (Array.isArray(v))
        for (const s of v) if (s.file === f) s.file = dst.replace("evidence/", "");
    }
    after += fs.statSync(dst).size;
  }
  fs.writeFileSync("evidence-map.json", JSON.stringify(map, null, 2));
  console.log(`  ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB`);
  await b.close();
})();
