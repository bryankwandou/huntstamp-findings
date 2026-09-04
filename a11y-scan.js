// Measurable accessibility checks on /pm: colour contrast against WCAG AA,
// visible focus, duplicate ids, reduced motion, and 200% zoom reflow.
//
//   node a11y-scan.js
//
// Every number here is computed from the live page, not asserted. Read-only.

const fs = require("fs");
const { chromium } = require("playwright");

const BASE = "https://app.manic.trade/pm";
const NAV = { waitUntil: "domcontentloaded", timeout: 120000 };

const CONTRAST = `(() => {
  // WCAG relative luminance and contrast ratio.
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => {
    const m = String(s).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  // Walk up for the first non-transparent background.
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.05) return c;
      n = n.parentElement;
    }
    const b = parse(getComputedStyle(document.body).backgroundColor);
    return b && b.a > 0.05 ? b : { r: 255, g: 255, b: 255, a: 1 };
  };
  const ratio = (a, b) => {
    const l1 = lum(a.r, a.g, a.b), l2 = lum(b.r, b.g, b.b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("*")) {
    const txt = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ").trim();
    if (!txt || txt.length < 2) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;

    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const cr = ratio(fg, bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = large ? 3.0 : 4.5;
    if (cr >= required) continue;

    const key = cs.color + "|" + size + "|" + txt.slice(0, 20);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text: txt.slice(0, 48),
      color: cs.color,
      background: "rgb(" + bg.r + "," + bg.g + "," + bg.b + ")",
      fontSizePx: size,
      fontWeight: weight,
      ratio: Math.round(cr * 100) / 100,
      requiredAA: required,
      largeText: large,
    });
  }
  return out.sort((a, b) => a.ratio - b.ratio);
})()`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const out = { scannedAt: new Date().toISOString() };

  await page.goto(BASE, NAV);
  await page.waitForFunction(() => document.body.innerText.includes("Trending"), { timeout: 90000 });
  await page.waitForTimeout(10000);

  // ---- contrast --------------------------------------------------------
  const fails = await page.evaluate(CONTRAST);
  out.contrast = {
    failingCombinations: fails.length,
    worst: fails.slice(0, 12),
    belowThree: fails.filter((f) => f.ratio < 3).length,
  };
  console.log("contrast failures:", fails.length, "| worst:", fails[0] && fails[0].ratio);

  // ---- duplicate ids ---------------------------------------------------
  out.duplicateIds = await page.evaluate(() => {
    const c = {};
    document.querySelectorAll("[id]").forEach((e) => { c[e.id] = (c[e.id] || 0) + 1; });
    const dup = Object.entries(c).filter(([, n]) => n > 1);
    return { totalIds: Object.keys(c).length, duplicates: dup.length, sample: dup.slice(0, 8) };
  });

  // ---- visible focus ---------------------------------------------------
  out.focus = await page.evaluate(() => {
    const targets = [...document.querySelectorAll("button,a,input")]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; })
      .slice(0, 25);
    let invisible = 0;
    const sample = [];
    for (const el of targets) {
      const before = getComputedStyle(el);
      const b = { outline: before.outlineStyle + before.outlineWidth, shadow: before.boxShadow, border: before.borderColor };
      el.focus();
      const after = getComputedStyle(el);
      const a = { outline: after.outlineStyle + after.outlineWidth, shadow: after.boxShadow, border: after.borderColor };
      const changed = b.outline !== a.outline || b.shadow !== a.shadow || b.border !== a.border;
      if (!changed) {
        invisible++;
        if (sample.length < 6)
          sample.push((el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30));
      }
      el.blur();
    }
    return { checked: targets.length, noVisibleFocusChange: invisible, sample };
  });

  // ---- reduced motion --------------------------------------------------
  await ctx.close();
  const rmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rm = await rmCtx.newPage();
  await rm.goto(BASE, NAV);
  await rm.waitForFunction(() => document.body.innerText.includes("Trending"), { timeout: 90000 });
  await rm.waitForTimeout(8000);
  out.reducedMotion = await rm.evaluate(() => {
    const animated = [...document.querySelectorAll("*")].filter((e) => {
      const cs = getComputedStyle(e);
      const dur = parseFloat(cs.animationDuration) || 0;
      const tr = parseFloat(cs.transitionDuration) || 0;
      const r = e.getBoundingClientRect();
      return (dur > 0.05 || tr > 0.05) && r.width > 4 && r.height > 4;
    });
    return {
      honoured: matchMedia("(prefers-reduced-motion: reduce)").matches,
      stillAnimating: animated.length,
      sample: animated.slice(0, 5).map((e) =>
        e.tagName + "." + String(e.className).split(" ")[0].slice(0, 24)),
    };
  });

  // ---- 200% zoom reflow (WCAG 1.4.10) ----------------------------------
  await rm.setViewportSize({ width: 640, height: 512 }); // 1280x1024 at 200%
  await rm.waitForTimeout(9000);
  out.zoom200 = await rm.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    overflowBy: document.documentElement.scrollWidth - window.innerWidth,
  }));
  await rm.screenshot({ path: "evidence/F-26-zoom200.png" });

  fs.writeFileSync("a11y-scan.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 2600));
  await browser.close();
})();
