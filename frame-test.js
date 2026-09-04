// Does app.manic.trade actually render inside a third-party iframe?
// A missing X-Frame-Options header is only a finding if the framing works.
// Read-only: the frame is loaded and inspected, nothing is clicked.
const { chromium } = require("playwright");
const fs = require("fs");

const HOST = `<!doctype html><meta charset="utf-8"><title>frame check</title>
<body style="margin:0;font:14px system-ui">
<p id="s">loading…</p>
<iframe id="f" src="https://app.manic.trade/pm" width="1200" height="700"
        style="border:2px solid #c00"></iframe>`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();

  const blocked = [];
  ctx.on("console", (m) => {
    const t = m.text();
    if (/frame|X-Frame|refused|ancestors|CSP/i.test(t)) blocked.push(t.slice(0, 200));
  });

  // Serve the host page from a different origin than manic.trade.
  await page.route("https://frame-test.invalid/**", (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: HOST })
  );
  await page.goto("https://frame-test.invalid/", { waitUntil: "domcontentloaded" });

  // The app is slow to hydrate; wait for real content, not a fixed interval.
  const deadline = Date.now() + 150000;
  let framedSoFar = "";
  while (Date.now() < deadline) {
    const fr = page.frames().find((f) => f.url().includes("app.manic.trade"));
    if (fr) {
      framedSoFar = await fr
        .evaluate(() => document.body.innerText.replace(/\s+/g, " "))
        .catch(() => "");
      if (framedSoFar.length > 200) break;
    }
    await page.waitForTimeout(3000);
  }

  const result = await page.evaluate(() => {
    const f = document.getElementById("f");
    let inner = null, sameOriginReadable = false;
    try {
      const d = f.contentDocument;
      if (d) { inner = (d.body.innerText || "").replace(/\s+/g, " ").slice(0, 200); sameOriginReadable = true; }
    } catch { /* cross-origin, as expected */ }
    return {
      frameExists: !!f,
      contentDocumentReadable: sameOriginReadable,
      innerTextIfReadable: inner,
    };
  });

  // The authoritative check: did a frame for that URL actually attach and load?
  const frames = page.frames().map((fr) => fr.url());
  const manicFrame = page.frames().find((fr) => fr.url().includes("app.manic.trade"));
  let framedText = null;
  if (manicFrame) {
    framedText = await manicFrame
      .evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 300))
      .catch((e) => "evaluate failed: " + e.message);
  }

  await page.screenshot({ path: "evidence/F-18-framed.png" });

  const out = {
    hostOrigin: "https://frame-test.invalid",
    framedUrl: "https://app.manic.trade/pm",
    ...result,
    framesAttached: frames,
    manicFrameLoaded: !!manicFrame,
    textRenderedInsideFrame: framedText,
    browserBlockMessages: blocked,
    charsRenderedInFrame: framedText ? framedText.length : 0,
    verdict:
      manicFrame && framedText && framedText.length > 200
        ? "FRAMED: the application rendered inside a cross-origin iframe"
        : manicFrame && framedText && framedText.length > 0
        ? "FRAMED but still hydrating: the frame attached and painted, the browser raised no objection"
        : "NOT FRAMED: the browser refused to display it",
  };
  fs.writeFileSync("frame-test.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
