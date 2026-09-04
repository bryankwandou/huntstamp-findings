// Walk the routes outside /pm that a logged-out visitor can reach, and check
// each for the same classes of defect found on the Polymarket surface.
//
//   node surface-scan.js
//
// Read-only: no wallet, no funds, no orders, no form submissions.

const fs = require("fs");
const { chromium } = require("playwright");

const BASE = "https://app.manic.trade";
const NAV = { waitUntil: "domcontentloaded", timeout: 120000 };
const ROUTES = ["/", "/leaderboard", "/referral", "/discover", "/pm/up-down", "/up-down"];

const out = { scannedAt: new Date().toISOString(), routes: {} };

async function audit(page) {
  return page.evaluate(() => {
    const t = document.body.innerText;
    const q = (s) => [...document.querySelectorAll(s)];

    // Focusable controls collapsed to zero size stay in the tab order.
    const zero = q("button,a,input,select,textarea").filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width === 0 && r.height === 0 && e.tabIndex >= 0 && !e.disabled;
    });

    // Controls a screen reader cannot name.
    const unnamed = q("button,a").filter((e) => {
      const label = (e.innerText || "").trim() || e.getAttribute("aria-label") ||
        e.getAttribute("title") || e.querySelector("img[alt]")?.alt;
      const r = e.getBoundingClientRect();
      return !label && r.width > 0 && r.height > 0;
    });

    const imgs = q("img");
    const months = ["January","February","March","April","May","June","July",
                    "August","September","October","November","December"];
    const now = new Date();
    const stale = months.filter((m, i) =>
      i !== now.getMonth() && new RegExp("\\b" + m + "\\b").test(t));

    return {
      textLength: t.length,
      title: document.title,
      h1: q("h1").length,
      h2: q("h2").length,
      headings: q("h1,h2,h3,h4").length,
      mains: q("main").length,
      navs: q("nav").length,
      zeroSizedFocusable: zero.length,
      unnamedControls: unnamed.length,
      unnamedSample: unnamed.slice(0, 5).map((e) =>
        e.tagName + (e.className ? "." + String(e.className).split(" ")[0] : "")),
      images: imgs.length,
      imagesWithoutAlt: imgs.filter((i) => !i.alt).length,
      inputsWithoutLabel: q("input").filter((i) =>
        !i.getAttribute("aria-label") && !i.labels?.length &&
        !i.getAttribute("aria-labelledby") && !i.placeholder).length,
      lang: document.documentElement.lang || null,
      staleMonthNames: stale,
      currentMonth: months[now.getMonth()],
      // Formatting consistency across the page.
      percentFormats: [...new Set((t.match(/\d+(\.\d+)?%/g) || []))].slice(0, 30),
      moneyFormats: [...new Set((t.match(/\$[\d,.]+[KMB]?/g) || []))].slice(0, 20),
      hasSkipLink: /skip to content/i.test(t),
      firstText: t.replace(/\s+/g, " ").slice(0, 160),
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  ctx.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  ctx.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 200)));

  const page = await ctx.newPage();

  for (const route of ROUTES) {
    process.stdout.write("· " + route + " … ");
    try {
      const res = await page.goto(BASE + route, NAV);
      await page.waitForTimeout(14000);
      const a = await audit(page);
      out.routes[route] = {
        httpStatus: res ? res.status() : null,
        landedOn: new URL(page.url()).pathname,
        redirected: new URL(page.url()).pathname !== route,
        ...a,
      };
      const name = route === "/" ? "root" : route.replace(/\//g, "-").replace(/^-/, "");
      await page.screenshot({ path: `evidence/F-25-${name}.png` });
      console.log(`ok  (${out.routes[route].httpStatus}, h1=${a.h1}, unnamed=${a.unnamedControls})`);
    } catch (e) {
      out.routes[route] = { error: String(e.message).split("\n")[0] };
      console.log("failed: " + String(e.message).split("\n")[0]);
    }
  }

  out.consoleErrors = [...new Set(consoleErrors)].slice(0, 15);
  out.consoleErrorCount = consoleErrors.length;
  out.uncaughtPageErrors = [...new Set(pageErrors)].slice(0, 10);

  fs.writeFileSync("surface-scan.json", JSON.stringify(out, null, 2));
  console.log("\nwritten: surface-scan.json");
  for (const [r, v] of Object.entries(out.routes)) {
    if (v.error) { console.log(`  ${r}: ERROR ${v.error}`); continue; }
    console.log(`  ${r.padEnd(14)} status=${v.httpStatus} h1=${v.h1} headings=${v.headings} ` +
      `mains=${v.mains} zero=${v.zeroSizedFocusable} unnamed=${v.unnamedControls} ` +
      `noAlt=${v.imagesWithoutAlt}/${v.images} stale=${v.staleMonthNames.join(",") || "-"}`);
  }
  await browser.close();
})();
