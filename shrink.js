// Re-encode the live screenshots to JPEG so the whole report fits a deploy.
// Quality is kept high enough that every measured figure stays legible; the
// PNG originals stay on disk and in the repository.
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  let before = 0, after = 0, n = 0;
  for (const f of fs.readdirSync("evidence").filter((x) => x.endsWith("-live.png"))) {
    const src = "evidence/" + f;
    const buf = fs.readFileSync(src);
    before += buf.length;
    const out = await p.evaluate(async (d) => {
      const img = new Image();
      img.src = "data:image/png;base64," + d;
      await img.decode();
      const scale = Math.min(1, 1700 / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const x = c.getContext("2d");
      x.fillStyle = "#0d1117";
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.9).split(",")[1];
    }, buf.toString("base64"));
    const dst = src.replace(/\.png$/, ".jpg");
    fs.writeFileSync(dst, Buffer.from(out, "base64"));
    after += fs.statSync(dst).size;
    n++;
  }
  console.log(`  ${n} images  ${(before/1048576).toFixed(1)} MB -> ${(after/1048576).toFixed(1)} MB`);
  await b.close();
})();
