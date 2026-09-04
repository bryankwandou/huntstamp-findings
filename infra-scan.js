// Infrastructure sweep: what the servers say in their headers and well-known
// files, across both the app origin and the API origin. Read-only HEAD/GET.
//
//   node infra-scan.js
//
// This is the layer a user never sees but a reviewer can verify in one curl:
// cache directives on authenticated-looking data, CORS on the API, cookie
// flags, and the well-known files (robots, security.txt, sitemap) that decide
// how the site is crawled and how a researcher is meant to reach the team.

const fs = require("fs");
const https = require("https");

function req(host, path, method) {
  return new Promise((resolve) => {
    const r = https.request({ host, path, method, headers: { "User-Agent": "manic-bounty-scan/1.0",
        "Origin": "https://evil.example.com" } },
      (res) => { let b=""; res.setEncoding("utf8"); res.on("data",c=>b+=c);
        res.on("end",()=>resolve({ status: res.statusCode, headers: res.headers, body: b })); });
    r.on("error", () => resolve({ status: 0, headers: {}, body: "" }));
    r.setTimeout(40000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: "" }); });
    r.end();
  });
}

(async () => {
  const out = { scannedAt: new Date().toISOString(), wellKnown: {}, headers: {}, cors: {}, cookies: {} };

  // Well-known files on the app origin.
  for (const p of ["/robots.txt", "/.well-known/security.txt", "/security.txt", "/sitemap.xml", "/manifest.json", "/favicon.ico"]) {
    const r = await req("app.manic.trade", p, "GET");
    out.wellKnown[p] = { status: r.status, bytes: r.body.length,
      firstLine: (r.body.split("\n")[0] || "").slice(0, 120),
      contentType: r.headers["content-type"] || null };
  }

  // Security-relevant response headers on a set of routes, both origins.
  const targets = [
    ["app.manic.trade", "/"],
    ["app.manic.trade", "/pm"],
    ["app.manic.trade", "/leaderboard"],
    ["bo-server-api.manic.trade", "/charts/pm/events?tag=sports&sort=trending&limit=1&offset=0&lite=true"],
  ];
  const wanted = ["content-security-policy","x-frame-options","x-content-type-options",
    "referrer-policy","permissions-policy","strict-transport-security",
    "cross-origin-opener-policy","cross-origin-resource-policy","cross-origin-embedder-policy",
    "cache-control","access-control-allow-origin","access-control-allow-credentials",
    "vary","server","x-powered-by","set-cookie","content-type"];
  for (const [host, path] of targets) {
    const r = await req(host, path, "GET");
    const h = {};
    wanted.forEach((k) => { if (r.headers[k] !== undefined) h[k] = Array.isArray(r.headers[k]) ? r.headers[k] : r.headers[k]; });
    const key = host + path.split("?")[0];
    out.headers[key] = { status: r.status, present: h,
      missingSecurity: wanted.slice(0, 9).filter((k) => r.headers[k] === undefined) };

    // Did the API reflect our forged Origin back? That plus allow-credentials
    // would let any site read a signed-in user's API responses.
    if (host.startsWith("bo-server")) {
      out.cors[key] = {
        allowOrigin: r.headers["access-control-allow-origin"] || null,
        allowCredentials: r.headers["access-control-allow-credentials"] || null,
        reflectsArbitraryOrigin: r.headers["access-control-allow-origin"] === "https://evil.example.com",
        wildcard: r.headers["access-control-allow-origin"] === "*",
      };
    }

    // Cookie flags.
    const sc = r.headers["set-cookie"];
    if (sc) out.cookies[key] = (Array.isArray(sc) ? sc : [sc]).map((c) => {
      const name = c.split("=")[0];
      return { name, secure: /;\s*Secure/i.test(c), httpOnly: /;\s*HttpOnly/i.test(c),
        sameSite: (c.match(/;\s*SameSite=([^;]+)/i) || [])[1] || null };
    });
  }

  fs.writeFileSync("infra-scan.json", JSON.stringify(out, null, 2));

  console.log("=== well-known files ===");
  for (const [p, v] of Object.entries(out.wellKnown)) console.log(`  ${String(v.status).padStart(3)}  ${p}  (${v.bytes}b)`);
  console.log("\n=== missing security headers per route ===");
  for (const [k, v] of Object.entries(out.headers)) console.log(`  ${k}\n       missing: ${v.missingSecurity.join(", ") || "none"}`);
  console.log("\n=== CORS on the API ===");
  for (const [k, v] of Object.entries(out.cors)) console.log(`  ${k}\n       ${JSON.stringify(v)}`);
  console.log("\n=== cookies ===");
  for (const [k, v] of Object.entries(out.cookies)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  console.log("\n=== cache-control seen ===");
  for (const [k, v] of Object.entries(out.headers)) console.log(`  ${k}: ${v.present["cache-control"] || "(none)"}`);
  console.log("\nwritten: infra-scan.json");
})();
