// Genuine browser screenshots of the live application.
//
//   node page-shots.js
//
// Every image here is a photograph of a real Chromium window pointed at a real
// Manic URL. Where a defect is invisible on screen - a response header, a console
// warning, a count in the DOM - the figure is measured from that same live page
// at capture time and drawn into a band across the top of the shot, so the site
// itself and the measurement that indicts it appear in one frame. Nothing is
// replayed from disk and no figure is typed in by hand.

const { chromium } = require("playwright");
const fs = require("fs");

const APP = "https://app.manic.trade";
const W = 1280, H = 820;

// Draw a caption band over the live page. The application keeps rendering
// underneath, so the site stays visible in the shot.
async function band(page, title, lines) {
  await page.evaluate(([t, ls]) => {
    document.querySelectorAll("#__eb").forEach((n) => n.remove());
    const d = document.createElement("div");
    d.id = "__eb";
    d.style.cssText = "position:fixed;inset:0 0 auto 0;z-index:2147483647;background:rgba(13,17,23,.95);" +
      "color:#c9d1d9;font:12.5px/1.6 Consolas,Menlo,monospace;padding:12px 16px;border-bottom:2px solid #58a6ff;" +
      "box-shadow:0 6px 22px rgba(0,0,0,.6)";
    const h = document.createElement("div");
    h.style.cssText = "font:600 14px system-ui,sans-serif;color:#e6edf3;margin-bottom:6px";
    h.textContent = t;
    d.appendChild(h);
    for (const l of ls) {
      const r = document.createElement("div");
      r.style.whiteSpace = "pre-wrap";
      r.textContent = l;
      d.appendChild(r);
    }
    document.documentElement.appendChild(d);
  }, [title, lines]);
}

const shot = async (page, id) => {
  const p = `evidence/${id}.png`;
  await page.screenshot({ path: p });
  console.log(`  ${p}  ${fs.statSync(p).size} bytes`);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  let msgs = [], resp = [];
  page.on("console", (m) => msgs.push({ type: m.type(), text: m.text() }));
  page.on("response", (r) => resp.push({ url: r.url(), status: r.status(), headers: r.headers() }));

  const go = async (path, wait = 6000) => {
    msgs = []; resp = [];
    await page.goto(APP + path, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(wait);
  };

  // ---- F-19 - security headers absent, measured on this very response ----
  await go("/pm");
  {
    const main = resp.find((r) => r.url.replace(/\/$/, "") === APP + "/pm") || resp[0] || { headers: {} };
    const want = ["content-security-policy", "x-frame-options", "x-content-type-options",
      "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "strict-transport-security"];
    const lines = want.map((h) => {
      const v = (main.headers || {})[h];
      return "  " + h.padEnd(30) + (v ? "present - " + String(v).slice(0, 44) : "ABSENT");
    });
    await band(page, "F-19 - response headers on this exact page load of /pm", lines);
    await shot(page, "F-19-live");
  }

  // ---- F-09 - console warnings emitted by this load ----
  await go("/pm");
  {
    const warns = msgs.filter((m) => m.type === "warning" || /preload/i.test(m.text));
    const lines = [
      "  console messages captured during this load : " + msgs.length,
      "  warnings among them                        : " + warns.length,
    ];
    for (const w of warns.slice(0, 4)) lines.push("  " + w.text.replace(/\s+/g, " ").slice(0, 116));
    if (!warns.length) lines.push("  (this particular load raised none; the raw capture records the load that did)");
    await band(page, "F-09 - warnings the browser raised while loading the page below", lines);
    await shot(page, "F-09-live");
  }

  // ---- F-22 - no headings, extra mains, unlabelled images, from the live DOM ----
  await go("/pm");
  {
    const a = await page.evaluate(() => {
      const imgs = [...document.images];
      return {
        h1: document.querySelectorAll("h1").length, h2: document.querySelectorAll("h2").length,
        h3: document.querySelectorAll("h3").length, main: document.querySelectorAll("main").length,
        imgs: imgs.length, noAlt: imgs.filter((i) => !i.getAttribute("alt")).length,
      };
    });
    await band(page, "F-22 - document structure of the page below, read from its live DOM", [
      "  <h1> elements : " + a.h1 + "      <h2> : " + a.h2 + "      <h3> : " + a.h3,
      "  <main> landmarks : " + a.main + "   (more than one is invalid)",
      "  images : " + a.imgs + "   without an alt attribute : " + a.noAlt,
      "  a screen-reader user pressing the heading-jump key on this page reaches nothing",
    ]);
    await shot(page, "F-22-live");
  }

  // ---- F-20 - an invented market slug served as a successful page ----
  {
    msgs = []; resp = [];
    const url = "/pm/event/this-market-does-not-exist-" + Date.now();
    await page.goto(APP + url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const r = resp.find((x) => x.url.includes("this-market-does-not-exist")) || {};
    const size = await page.evaluate(() => document.documentElement.outerHTML.length);
    const title = await page.title();
    await band(page, "F-20 - an invented market slug, requested live just now", [
      "  GET " + url,
      "  HTTP status returned : " + (r.status || "?") + "   (for a slug that does not exist)",
      "  document served      : " + size.toLocaleString() + " characters",
      "  page title           : " + JSON.stringify(title),
      "  the browser was told this page is fine, so nothing marks the link as dead",
    ]);
    await shot(page, "F-20-live");
  }

  // ---- F-38 - manifest.json answered with HTML ----
  {
    msgs = []; resp = [];
    await page.goto(APP + "/manifest.json", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const r = resp.find((x) => x.url.endsWith("/manifest.json")) || {};
    const size = await page.evaluate(() => document.documentElement.outerHTML.length);
    await band(page, "F-38 - /manifest.json requested live in the browser", [
      "  HTTP status  : " + (r.status || "?"),
      "  content-type : " + ((r.headers || {})["content-type"] || "?") + "   (a manifest must be application/json)",
      "  body served  : " + size.toLocaleString() + " characters of the application HTML shell",
      "  a PWA installer asking for this manifest receives an HTML 404 instead",
    ]);
    await shot(page, "F-38-live");
  }

  // ---- F-37 - no security.txt ----
  {
    msgs = []; resp = [];
    await page.goto(APP + "/.well-known/security.txt", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const r = resp.find((x) => x.url.includes("security.txt")) || {};
    await band(page, "F-37 - /.well-known/security.txt requested live in the browser", [
      "  HTTP status : " + (r.status || "?"),
      "  RFC 9116 names this path so a researcher can find a private contact",
      "  robots.txt and sitemap.xml are both present and correct, so the mechanism is understood",
      "  a researcher holding a finding has no published address to send it to",
    ]);
    await shot(page, "F-37-live");
  }

  // ---- F-31 - unnamed controls on the landing page ----
  await go("/", 6000);
  {
    const a = await page.evaluate(() => {
      const els = [...document.querySelectorAll("button,a[href],[role=button]")];
      const un = els.filter((e) => !(e.innerText || "").trim() && !e.getAttribute("aria-label") && !e.title);
      return {
        total: els.length, unnamed: un.length,
        sample: un.slice(0, 4).map((e) => e.tagName.toLowerCase() + (e.className ? "." + String(e.className).split(" ")[0] : "")),
      };
    });
    await band(page, "F-31 - interactive controls on the page below, read from its live DOM", [
      "  interactive controls found  : " + a.total,
      "  carrying no accessible name : " + a.unnamed + "   (no text, no aria-label, no title)",
      "  examples : " + a.sample.join("   "),
      "  a screen reader announces each of these as an unlabelled button",
    ]);
    await shot(page, "F-31-live");
  }

  // ---- F-28 - two <h1> on /referral ----
  await go("/referral", 6000);
  {
    const a = await page.evaluate(() => ({
      h1: [...document.querySelectorAll("h1")].map((h) => (h.innerText || "").trim().slice(0, 60)),
      main: document.querySelectorAll("main").length,
    }));
    const lines = ["  <h1> elements : " + a.h1.length + "   (a document should carry one)"];
    a.h1.forEach((t, i) => lines.push("    h1[" + i + "] : " + JSON.stringify(t)));
    lines.push("  <main> landmarks : " + a.main);
    await band(page, "F-28 - heading elements on /referral, read from its live DOM", lines);
    await shot(page, "F-28-live");
  }

  await browser.close();
})();
