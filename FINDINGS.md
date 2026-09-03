# Manic Trade — Polymarket Integration Bug Bounty
## Findings log — session 1 (2026-09-03)

**Environment** (identical for every finding unless stated)

| Field | Value |
|---|---|
| URL under test | `https://app.manic.trade/pm` |
| Build | Vercel deployment `dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs` |
| Browser | Chromium 148.0.7778.280 |
| OS | Windows 11, build 26200 |
| Viewport | 1280×720 desktop; 375×812 for the mobile checks |
| Wallet | none connected — guest / logged-out session |
| Solana program id logged by the app | `GkRa3woLov2vw9BopLmHkAqdwpcwzoLcspMNgpcaEJPG` |

**Coverage against the bounty scope**

| Scope area | Covered | Notes |
|---|---|---|
| Market discovery and navigation | yes | F-01, F-05, F-12, F-13 |
| Event details, prices, charts, market info | yes | F-02, F-03, F-06, F-07, F-08, F-11 |
| Deposits and real-money trading | no | requires funded account |
| Orders, positions, balances, P&L | no | requires funded account |
| Market status and settlement | partial | F-02, F-03, F-05 — display side only |
| Mobile / browser / wallet compatibility | partial | F-14, F-15, F-17; wallet flow untested |

---

## F-01 — `/pm` never opens the market directory for a returning user
**Proposed severity: P2 (Medium)** · workaround: close the restored tab or clear site data

The entry point named in the bounty brief, `app.manic.trade/pm`, stops rendering the market directory once a user has opened any event. The app persists the open-tab list in `localStorage` under `pm-events-store` and, on load, silently reopens the stored event and rewrites the address bar to `/pm/event/<id>`.

**Steps to reproduce**
1. Open `https://app.manic.trade/pm` in a clean profile. The directory grid renders.
2. Click any event card. The event view opens; the address bar becomes `/pm/event/<slug>`.
3. Type `https://app.manic.trade/pm` in the address bar and press Enter.

**Actual** — the event from step 2 is restored and the address bar is rewritten back to `/pm/event/<slug>`. The directory is never shown.

**Expected** — `/pm` renders the market directory. A restored session tab should not override an explicit navigation to the directory URL.

**Evidence**
- `location.pathname` immediately after requesting `/pm` → `/pm/event/atp-faria-alcaraz-2026-09-02`
- `localStorage['pm-events-store']` →
  `{"state":{"category":"all","surface":"catalog","sidebarCollapsed":false,"openEventIds":["atp-faria-alcaraz-2026-09-02"],"tabMeta":{…}}}`
- `localStorage.removeItem('pm-events-store')` followed by a reload restores the directory. This is the confirming test for the root cause.

**Impact** — the documented landing URL is unusable for returning users. Anyone following a link to `/pm` — docs, blog, the bounty brief itself — lands on a stale market rather than discovery. In the observed case the restored market was already resolved, so a returning user's first screen was a dead market.

---

## F-02 — Resolved market shows two contradictory price sets; outcome prices sum to 101%
**Proposed severity: P1 (Severe)** · incorrect prices and settlement display

Event: `US Open ATP: Jaime Faria vs Carlos Alcaraz`
URL: `https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02`

The Moneyline market is settled. The right-hand panel reads `OUTCOME: CARLOS ALCARAZ` and `Resolved`; the header reads `Carlos Alcaraz 100% / Jaime Faria 0%`. Directly beneath, the price chart legend for that same market reads `Jaime Faria 9% / Carlos Alcaraz 92%`.

**Steps to reproduce**
1. Open the event URL above.
2. Read the outcome block at the top of the centre panel.
3. Read the chart legend immediately underneath it.

**Actual** — two different price sets for one market on one screen:
- `Carlos Alcaraz 100%`, `Jaime Faria 0%` (settlement values)
- `Jaime Faria 9%`, `Carlos Alcaraz 92%` (chart legend) — these sum to **101%**

**Expected** — one price set. On a resolved market the displayed prices should be the settlement values. Complementary outcomes must never sum above 100%.

**Evidence** — page text captured verbatim from the rendered DOM:
```
Carlos Alcaraz
100%
Jaime Faria
0%
Jaime Faria
9%
Carlos Alcaraz
92%
```
Chart tooltip on the last data point: `Sep 2, 2026, 09:00:16`.

**Impact** — a trader reading the chart legend sees a market that looks live and mispriced: an outcome quoted at 92c that is in fact already worth $1. The same defect on a market that has not yet settled would present a false arbitrage.

---

## F-03 — Settlement time on an already-resolved market is dated a week in the future
**Proposed severity: P2 (Medium)**

Same event as F-02. The match was played 2026-09-02 — the event slug itself is `atp-faria-alcaraz-2026-09-02` — the scoreboard shows `FT 2 - 6`, and the market is labelled `Resolved` with the order book reading `Market Ended`.

**Actual** — `Settlement Time: Sep 9, 3:00 PM UTC`: seven days after the match, six days after the date of test.

**Expected** — the actual settlement timestamp, or no settlement countdown at all on a market already marked Resolved.

**Impact** — a user checking when funds are released is shown a date with no relation to the settlement that already happened.

---

## F-04 — Outcome price renders as `--` while the Yes/No buy buttons stay enabled
**Proposed severity: P2 (Medium)** · observed once; frequency intermittent

Card: `New York Yankees vs. Los Angeles Angels`, default Trending grid on `/pm`.

**Actual**
```
O/U 2.5        50%   Y  N
Extra Innings  --    Y  N
```
The `Extra Innings` outcome carries no price, yet both order buttons remain active and clickable. On a later reload the same card rendered `O/U 2.5 78%` and `O/U 4.5 84%`, so the missing price is transient rather than permanent — which makes it harder for a user to notice.

**Expected** — an outcome with no price should be hidden, or its buy buttons disabled with a "price unavailable" state. A user must not be able to open an order flow against an outcome the UI cannot price.

**Impact** — entry into an order flow with no visible price. On a real-money venue that is the setup for an order placed at a price the user never saw.

---

## F-05 — Resolved market stays in the Trending grid with live Yes/No buy buttons
**Proposed severity: P2 (Medium)** · reproduced across two separate page loads

The card `US Open ATP: Jaime Faria vs Carlos Alcaraz Total Sets: O/U 3.5` sits in the default Trending feed of `/pm` showing `100.0%` and both `Y` and `N` buttons. Opening the card reveals the market is Resolved and the order book reads `Market Ended`.

**Expected** — resolved markets filtered out of Trending, or displayed with a `Resolved` badge and disabled order controls.

**Impact** — the default discovery surface, the first screen of the integration, promotes markets that cannot be traded.

---

## F-06 — Percentage formatting is inconsistent across the grid
**Proposed severity: P3 (Minor)**

On a single render of `/pm`, 35 distinct percentage values are displayed. 34 are integers; exactly one is rendered to one decimal place.

**Evidence** — extracted from `document.body.innerText`:
`["90%","10%","52%","48%","53%","25%","12%","85%","15%","42%","22%","100.0%","17%","16%","50%", …]`
Only `100.0%` carries a decimal. Suggests a special case in the rounding path at the 100% boundary.

**Expected** — one precision rule for every outcome price.

---

## F-07 — Outcome labels repeat the full event title, so every prop truncates identically
**Proposed severity: P3 (Minor)**

On the event page for `US Open ATP: Jaime Faria vs Carlos Alcaraz`, each entry in the Props rail is named with the whole event title prepended:

```
US Open ATP: Jaime Faria vs Carlos Alcaraz Total Sets: O/U 3.5
US Open ATP: Jaime Faria vs Carlos Alcaraz Set 1 Winner
US Open ATP: Jaime Faria vs Carlos Alcaraz Set 1 O/U 8.5
US Open ATP: Jaime Faria vs Carlos Alcaraz Game Spread +/-6.5
```

Rendered in the rail these all truncate to `US Open ATP: Jaime Faria vs Carl…`, so the part that distinguishes one prop from another is exactly the part that gets cut. Twenty-six props render as visually identical rows. The same duplicated label also appears as the outcome name inside the grid card whose title is already that event.

**Expected** — strip the event title from the market label in any context that already displays it: the rail should read `Total Sets: O/U 3.5`, `Set 1 Winner`, `Set 1 O/U 8.5`.

**Impact** — the props list cannot be scanned. Each entry has to be opened individually to identify it.

---

## F-08 — Volume renders as `-- Vol` instead of `$0`
**Proposed severity: P3 (Minor)**

Twelve props on the event page above show `-- Vol` where others show `$4K Vol`, `$116 Vol`, `$1K Vol`. Zero volume should render as `$0`; as it stands a user cannot distinguish "no trades yet" from "we failed to load this".

---

## F-09 — Landing-page hero assets are preloaded on the trading route and never used
**Proposed severity: P3 (Minor)** · performance

Loading `/pm` issues `<link rel=preload>` for two marketing assets that the trading route never renders. Chrome reports the waste itself:

```
The resource https://app.manic.trade/landing-v2/hero-video-fallback.png was preloaded
using link preload but not used within a few seconds from the window's load event.
The resource https://app.manic.trade/landing-v2/hero-kv-first-frame.jpg was preloaded
using link preload but not used within a few seconds from the window's load event.
```

Both are fetched at high priority and compete with the JavaScript the trading screen actually needs. Related metric from the same load: `performance.getEntriesByType('resource')` counts **113** `_next/static/chunks/*.js` requests and **250** resources in total for `/pm`.

---

## F-10 — `/pm` window load event takes 94–136 seconds
**Proposed severity: P2 (Medium)** · performance

Two consecutive cold loads of `/pm` on the same machine and connection:

| Load | TTFB | DOMContentLoaded | `loadEventEnd` |
|---|---|---|---|
| 1 | 56 ms | 1,653 ms | **94,029 ms** |
| 2 | 55 ms | 4,817 ms | **135,689 ms** |

**Control on the same machine, same session, minutes apart:** `https://polymarket.com` — TTFB 181 ms, DOMContentLoaded 1,349 ms. Network health is therefore not the explanation.

During both Manic loads the screen showed only the Manic logo and a three-dot spinner. `performance.getEntriesByType('resource')` shows roughly 100 static chunks each reporting ~84 s of wall time, all resolving together — the pattern of connection-pool saturation from requesting 113 separate JS chunks on one route.

**Expected** — a trading screen that reaches interactive in single-digit seconds.

**Note for the reviewer** — measured from Indonesia over a residential connection. Absolute numbers will differ elsewhere; the ratio against the Polymarket control on the same line is the reproducible part.

---

## F-11 — Same person spelled two different ways on two cards in one viewport
**Proposed severity: P3 (Minor)**

Visible simultaneously on `/pm`:
- `Republican Presidential Nominee 2028` lists the outcome as `J.D. Vance`
- `Presidential Election Winner 2028` lists the same person as `JD Vance`

**Expected** — one canonical rendering, so search and favourites match across markets.

---

## F-12 — Selecting a category silently discards the active search query
**Proposed severity: P3 (Minor)**

**Steps to reproduce**
1. On `/pm`, type `bitcoin` into Search markets. Nine matching Bitcoin markets render.
2. Click the `Politics` category chip.

**Actual** — the search input is emptied and the query is dropped without notice. Verified in the DOM: both `input[placeholder="Search markets"]` elements return `value === ""`.

**Expected** — either search composes with the category filter (search within Politics), or the app states that the query was cleared.

**Impact** — a user narrowing down by category loses their query and has to retype it.

---

## F-13 — Zero-result subcategories are offered as selectable filters
**Proposed severity: P3 (Minor)**

The Politics subcategory rail lists `Colombia Election 0`. It is selectable and, predictably, yields `No markets in this category`.

**Expected** — a subcategory whose own count is `0` should be hidden or disabled.

---

## F-14 — The empty state offers no way to clear the filter that produced it
**Proposed severity: P3 (Minor)** · worse on mobile

After selecting a zero-count subcategory the grid shows only the sentence `No markets in this category`. There is no "clear filter" or "show all" control anywhere on the screen — confirmed by scanning the rendered text for `clear|reset|show all`, which returns nothing.

At the 375×812 mobile viewport this gets worse: the subcategory rail is a horizontal scroller, the selected chip (`Colombia Election`) sits off-screen to the right, and the visible portion reads `All 2605 · Trump 298 · Midterms 1138 · Globa…`. A mobile user therefore sees an empty screen, no indication of which filter caused it, and no control to undo it.

**Expected** — an empty state that names the active filter and offers a one-tap reset.

---

## F-15 — 58 zero-size controls remain focusable in the tab order
**Proposed severity: P3 (Minor)** · accessibility

On `/pm`, 58 `button` / `a` / `input` elements have a bounding box of exactly 0×0 while remaining enabled and in the tab order. They are the collapsed half of the responsive layout — the desktop header and category rail are still in the DOM at mobile widths, and vice versa — hidden by zero sizing rather than by `display:none` or `hidden`.

**Evidence**
```js
[...document.querySelectorAll('button,a,input')]
  .filter(e => { const r = e.getBoundingClientRect();
                 return r.width === 0 && r.height === 0 && e.tabIndex >= 0 && !e.disabled }).length
// → 58
// sample innerText: "Monthly TournamentReal…", "Free Friday$200100 Dem…", "All", "Crypto", …
```

**Impact** — a keyboard user tabs through 58 invisible stops with no visible focus ring before reaching the market grid. Screen readers announce controls that are not on screen.

**Related** — 23 of the 25 `<img>` elements on the same page have no `alt` attribute, including every market thumbnail.

---

## F-16 — Nav CTA still reads "August Rewards" on 3 September
**Proposed severity: P3 (Minor)**

The primary nav shows a highlighted `August Rewards` call to action. The browser clock at time of test was `2026-09-03T04:26:35Z`. The panel behind it advertises a `Monthly Tournament` and a `Free Friday` promotion.

**Expected** — a monthly promotion label that follows the current month, or the September tournament in its place.

**Impact** — if September's tournament is live, the label is wrong; if it is not, the app is advertising a closed promotion as its most prominent nav item. Either way the first thing a user reads in the header is stale.

---

## F-17 — A click on empty page area triggered a clipboard write
**Proposed severity: P3 (Minor)** · not yet isolated, reported for awareness

While clicking an empty region of the market grid at the mobile viewport, the page fired a copy handler and overwrote the OS clipboard without any visible copy affordance under the cursor and without any confirmation.

Not reproduced a second time and the triggering element was not identified, so this is filed as an observation rather than a confirmed defect. Flagged because silent clipboard writes on a trading surface are worth a look — a user mid-way through pasting a wallet address would lose it.

---

## Withdrawn during this session
**Mobile subcategory chips appear non-functional.** Two taps on the `All` subcategory chip at 375×812 selected the label text instead of applying the filter, and the grid stayed empty. On re-testing, a programmatic `element.click()` on that same button applied the filter correctly (`empty: false`, active chip moved to `All 2606`), and the automation harness was timing out on synthetic clicks throughout that stretch. The evidence points at the test harness rather than the app, so this is **not** being submitted. Worth one manual pass on a real handset before it is ruled out entirely.

---

## Not tested — requires a funded account
Deposits, real-money order placement, order lifecycle, positions, balances, P&L calculation and settlement crediting. These carry the bounty's P0 and P1 weight, and none of them were exercised in this session.
