# Second sweep — seven further findings

Captured 4 September 2026, against deployment `dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce`.
Read-only throughout: logged out, no wallet, no funds, no orders.

The first sweep worked through the rendered interface. This one went after the layers
underneath it — response headers, routing, document structure, link metadata — plus one
security control that turned out to be missing.

Raw data: `probe-results.json`, `frame-test.json`, `sort-check.json`.

---

## F-18 · The application renders inside a cross-origin iframe · P2 · security

`app.manic.trade` sends neither `X-Frame-Options` nor a CSP `frame-ancestors` directive, so
any third-party page can embed the live trading interface and the browser raises no
objection.

**Demonstrated, not inferred.** A page served from an unrelated origin embedded
`https://app.manic.trade/pm` in an `<iframe>`. The frame attached, loaded, and painted the
real application. Text read back from inside the frame:

```
Skip to content Trade Referral Leaderboard August Rewards Log In Manic Trade
Polymarket Trade All Crypto Sports Politics Economy Tech Culture Weather Trending
Liquidity Volume Newest Ending Soon Competitive Hantavirus pandemic in 2026?
Yes 3% No 97% $18.0M Vol New pandemic in 2026? Yes 6% No 94% $1.
```

That is the market grid, live prices, the sort controls and the **Log In** button, rendering
under someone else's domain. The browser emitted no framing objection at all: the block-message
collector caught nothing.

Reproduce with `frame-test.js`, or by hand — serve this from any origin that is not
`manic.trade` and open it:

```html
<iframe src="https://app.manic.trade/pm" width="1200" height="700"></iframe>
```

**Expected.** `X-Frame-Options: DENY`, or `Content-Security-Policy: frame-ancestors 'none'`.

**Why it matters.** On a venue where a click places an order, a framed interface is the
setup for clickjacking: an attacker overlays their own page on top of the frame, and the
victim's click lands on a control they cannot see. The `Log In` button being reachable
inside the frame is the part worth looking at first.

**Caveat, stated plainly.** I demonstrated that the page frames. I did not build a working
clickjacking exploit, and I did not attempt one — that would need an interactive control and
a funded session, both outside the scope of a logged-out read-only test. Treat this as a
missing control with the framing proven, not as a proven end-to-end attack.

Evidence: `evidence/F-18-framed.png`, `frame-test.json`

---

## F-19 · No security response headers at all · P3 · security hygiene

Every one of these is absent from the `/pm` response:

| Header | Present? |
|---|---|
| `Content-Security-Policy` | absent |
| `X-Frame-Options` | absent |
| `X-Content-Type-Options` | absent |
| `Referrer-Policy` | absent |
| `Permissions-Policy` | absent |
| `Cross-Origin-Opener-Policy` | absent |

What *is* sent: `Strict-Transport-Security: max-age=63072000`, and `http://` correctly
redirects to `https://` with a 308.

The one cookie set on this route carries neither flag:

```
Set-Cookie: is-mobile=0; Path=/; Expires=…; Max-Age=86400; SameSite=lax
             Secure=NO   HttpOnly=NO   SameSite=lax
```

**Honest scoping.** `is-mobile` is a viewport hint, not a session token, and HSTS plus the
308 makes the missing `Secure` flag largely theoretical here. `X-Content-Type-Options:
nosniff` and a `Referrer-Policy` are the two worth adding regardless of anything else.
`frame-ancestors` is covered separately under F-18, which is where the real weight is.

Check it with:

```
curl -sSD - -o /dev/null https://app.manic.trade/pm
```

---

## F-20 · Any invented market slug returns HTTP 200, not 404 · P2

A market that does not exist is served as a successful page.

```
200  1,535,682 bytes   /pm/event/this-market-does-not-exist-2099
200  1,535,625 bytes   /pm/event/aaaaaaaaaaaa
200  1,535,661 bytes   /pm/event/atp-fake-fake-2099-12-31
```

The response carries the generic landing-page title rather than a market or an error:

```
<title>Manic.Trade: the First Momentum-based Trading Platform on Solana</title>
```

No `rel="canonical"`. In the browser the address is then rewritten to `/pm` and the market
directory renders, with nothing said about the market that was asked for.

**The routing is inconsistent**, which is what makes this a defect rather than a decision:

| Path | Status |
|---|---|
| `/pm/nonsense-subroute` | **404**, correct |
| `/pm/event/` | **404**, correct |
| `/pm/event/anything-at-all` | **200**, wrong |

**Expected.** 404 for a market slug that does not resolve, or a page that says the market
was not found.

**Why it matters.** Three separate costs. A user following an old or mistyped market link is
dumped on the directory with no explanation of where their market went. Search engines are
invited to index an unbounded space of invalid URLs as valid pages. And uptime monitoring
cannot tell a working market link from a broken one, because both return 200.

---

## F-21 · Route matching is case-sensitive · P3

```
/pm   →  200
/PM   →  404 "This page could not be found."
```

A link capitalised by an email client, a CMS, a print asset, or a person typing it out
lands on an error page. Lower-casing the path before matching is the usual fix.

---

## F-22 · Not one heading element on any page, and two `<main>` landmarks · P2 · accessibility

Counted directly in the HTML the server returns:

| Element | Directory `/pm` | Event page |
|---|---|---|
| `<h1>` | 0 | 0 |
| `<h2>` | 0 | 0 |
| `<h3>` | 0 | 0 |
| `<main>` | **2** | **2** |
| `<nav>` | 0 | 0 |

Confirmed a second way, in the live DOM after hydration: `document.querySelectorAll("h1")`
returns 0 and the full heading list `h1,h2,h3,h4` comes back empty.

**Two consequences.** A screen-reader user has no document outline to navigate by — the
heading-jump shortcut, which is the primary way many people move through a page, does
nothing at all here. And two `<main>` elements is invalid: the spec allows at most one
visible `main` per document, so assistive technology cannot tell which one is the content.

**Expected.** One `<h1>` per page naming it — the market title on an event page — with the
section headings below it in order, one `<main>`, and the navigation in a `<nav>`.

The market cards are already visually styled as headings. This is markup, not design: the
text is on screen, it is just not announced as structure.

---

## F-23 · The share preview advertises a settled market as still open · P2

The event that resolved on 2 September serves this to every link unfurler:

```html
<meta property="og:title"       content="US Open ATP: Jaime Faria vs Carlos Alcaraz">
<meta property="og:description" content="$4K traded · Ends Sep 9">
<meta name="description"        content="$4K traded · Ends Sep 9">
```

Paste that URL into Slack, X, Discord or Telegram and the card says the market ends on
9 September. The match was played on 2 September, the order book reads Market Ended, and the
page itself declares the outcome.

This is the same wrong date reported in F-03, but on a different surface and with a wider
audience: the preview is what people see *before* they click, and it is what gets forwarded.

**Expected.** A settled market's preview should say it settled, and give the settlement
result rather than a future close date.

Read it yourself with:

```
curl -sS https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02 | grep 'og:description'
```

---

## F-24 · Every 404 ships 1.44 MB · P3

```
404  1,512,170 bytes   /this-does-not-exist
404  1,512,170 bytes   /.well-known/security.txt
```

The not-found page carries the full application HTML. Every crawler hitting a dead link,
every mistyped URL and every stale bookmark costs a megabyte and a half of egress to render
five words of error text.

Related: `/.well-known/security.txt` is absent. For a platform running a public bug bounty,
publishing one is a small piece of housekeeping that tells researchers where to report.

---

## Things that were tested and found sound

Recorded because a report that only lists faults gives no sense of what was actually covered.

**Search input handling is clean.** Six hostile or awkward queries were typed into the market
search. None caused a script to run, an error to surface, or the page to break — each was
treated as an ordinary string that matched nothing.

| Query | Result |
|---|---|
| `<img src=x onerror=alert(1)>` | no results, no script executed |
| `'; DROP TABLE markets;--` | no results |
| `ﬀﬁ🎾🇺🇸` | no results, rendered correctly |
| 400 × `z` | no results, no layout break |
| `BITCOIN` | matched — search is case-insensitive |
| whitespace only | treated as no filter |

**No JavaScript errors during ordinary use.** Loading the directory, opening three markets
and navigating back each time produced zero console errors and zero uncaught exceptions.

**Price arithmetic in the grid is correct.** All eight complementary outcome pairs on the
directory summed to exactly 100. None exceeded it. This is the check that failed once during
the first sweep (F-02); it passes here, which supports treating F-02 as a narrow window
rather than a standing defect.

**No settled markets in any sort tab.** Ending Soon, Newest, Competitive, Volume and
Liquidity were each sampled; none surfaced a market priced at 0% or 100%.

**The Liquidity sort is not broken.** A first sample showed it returning 3 cards where every
other sort returned 24, which looked like a filter bug. Re-testing with longer waits showed
the grid climbing 3 -> 24 within a few seconds, and the Volume sort doing exactly the same
thing. The first sample had simply caught the grid mid-load. Recorded because it was very
nearly reported as a defect.

**API responses are prompt.** The slowest data call in a full session was 2,313 ms
(`events?tag=science&sort=trending&limit=500`); market resolution calls returned in about
1,700 ms. Nothing here supports the load-time claim withdrawn as F-10.

---

## Still untested, and still where the weight is

Deposits, order placement, order matching, positions, balances, withdrawals and settlement
crediting all require a funded account with real USDC at risk. None of it has been touched
in either sweep. On a real-money venue that is where the severe defects live, and everything
in both reports covers only the surface a logged-out visitor can reach.
