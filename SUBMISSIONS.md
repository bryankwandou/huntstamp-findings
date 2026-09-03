# Typeform submission pack — copy-paste blocks

Form: https://form.typeform.com/to/TzfbvaPZ — **one submission per finding**.
After the last one, complete the single final submission on Superteam Earn using the same
contact details.

## Shared environment block (paste into the environment field every time)

```
Device: Desktop PC, Windows 11 (build 26200)
Browser: Chromium 148.0.7778.280
Viewport: 1280x720 (mobile checks at 375x812)
Wallet: none connected — tested as a logged-out guest
Build: Vercel deployment dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
Time of test: 2026-09-03, 04:00–04:30 UTC
Frequency: see each report
```

## Submission order

Send the high-severity ones first — duplicates are resolved in favour of the earliest
complete report, so F-02 and F-01 should not sit behind eleven cosmetic tickets.

1. F-02 (P1) · 2. F-01 (P2) · 3. F-03 (P2) · 4. F-04 (P2) · 5. F-05 (P2) · 6. F-10 (P2)
7. F-12 · 8. F-14 · 9. F-15 · 10. F-07 · 11. F-16 · 12. F-06 · 13. F-08 · 14. F-09
15. F-11 · 16. F-13 · 17. F-17

---

## 1 — F-02 · P1

**Type:** Bug
**Title:** Resolved market shows two contradictory price sets; outcome prices sum to 101%

**Description**
On the settled Moneyline market for US Open ATP: Jaime Faria vs Carlos Alcaraz, the page
displays two different price sets for the same market at the same time. The outcome block
shows the settlement values, Carlos Alcaraz 100% and Jaime Faria 0%. The price chart legend
directly underneath shows Jaime Faria 9% and Carlos Alcaraz 92%. Those two add up to 101%,
which is not possible for complementary outcomes, and they contradict a settlement the page
has already declared two lines above.

**Steps to reproduce**
1. Open https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02
2. Read the outcome block at the top of the centre panel.
3. Read the chart legend immediately below it.

**Actual result**
Outcome block: Carlos Alcaraz 100%, Jaime Faria 0%. Chart legend: Jaime Faria 9%,
Carlos Alcaraz 92% — sum 101%. Right panel reads OUTCOME: CARLOS ALCARAZ / Resolved.
Chart tooltip on the final data point reads Sep 2, 2026, 09:00:16.

**Expected result**
One price set per market. On a resolved market the displayed prices should be the
settlement values. Complementary outcomes should never sum above 100%.

**Frequency:** every load of this event page.

---

## 2 — F-01 · P2

**Type:** Bug
**Title:** /pm never opens the market directory again once any event has been opened

**Description**
The entry point given in the bounty brief, app.manic.trade/pm, stops rendering the market
directory after a user opens any event. The open-tab list is persisted in localStorage under
pm-events-store; on load the app reopens the stored event and rewrites the address bar to
/pm/event/<id>. The directory becomes unreachable at its own URL.

**Steps to reproduce**
1. Open https://app.manic.trade/pm in a clean browser profile — the directory renders.
2. Click any event card — the address bar becomes /pm/event/<slug>.
3. Type https://app.manic.trade/pm in the address bar and press Enter.

**Actual result**
The event from step 2 is restored and the address bar is rewritten back to
/pm/event/<slug>. In my session that restored market was already resolved, so the first
screen a returning user sees is a dead market.
localStorage['pm-events-store'] contained:
{"state":{"category":"all","surface":"catalog","sidebarCollapsed":false,
"openEventIds":["atp-faria-alcaraz-2026-09-02"],"tabMeta":{...}}}
Running localStorage.removeItem('pm-events-store') and reloading restores the directory,
which confirms the cause.

**Expected result**
/pm renders the market directory. A restored session tab should not override an explicit
navigation to the directory URL.

**Frequency:** every time, once any event has been opened.

---

## 3 — F-03 · P2

**Type:** Bug
**Title:** Resolved market advertises a settlement time a week in the future

**Description**
The same US Open ATP event is marked Resolved with the order book reading Market Ended and
a final score of 2-6, yet the settlement field shows a date six days after the test date and
seven days after the match itself.

**Steps to reproduce**
1. Open https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02
2. Read the Settlement Time field.

**Actual result**
Settlement Time: Sep 9, 3:00 PM UTC. The match was played 2026-09-02, as the event slug
itself records, and the market already shows Resolved / Market Ended / FT 2 - 6.

**Expected result**
The real settlement timestamp, or no settlement countdown at all on a resolved market.

**Frequency:** every load of this event page.

---

## 4 — F-04 · P2

**Type:** Bug
**Title:** Outcome price renders as "--" while its Yes/No buy buttons stay enabled

**Description**
On the New York Yankees vs. Los Angeles Angels card in the default Trending grid, the
Extra Innings outcome rendered with no price at all, shown as a double dash, while both
order buttons stayed active and clickable. A user can start an order against an outcome
the interface could not price.

**Steps to reproduce**
1. Open https://app.manic.trade/pm with the Trending sort active.
2. Locate the New York Yankees vs. Los Angeles Angels card.
3. Read the second outcome row.

**Actual result**
O/U 2.5 shows 50% with Y and N buttons. Extra Innings shows "--" with Y and N buttons, both
enabled. On a later reload the same card rendered O/U 2.5 at 78% and O/U 4.5 at 84%, so the
missing price is transient — which makes it easier for a user to walk into.

**Expected result**
An outcome with no price should be hidden, or its buy buttons disabled with an explicit
"price unavailable" state.

**Frequency:** intermittent — observed once across several loads.

---

## 5 — F-05 · P2

**Type:** Bug
**Title:** Resolved market stays in the Trending grid with active Yes/No buy buttons

**Description**
The card "US Open ATP: Jaime Faria vs Carlos Alcaraz Total Sets: O/U 3.5" appears in the
default Trending feed on /pm showing 100.0% with both Y and N buttons rendered as live
controls. Opening it reveals the market is Resolved and the order book reads Market Ended.
The first discovery surface of the integration is promoting a market that cannot be traded.

**Steps to reproduce**
1. Open https://app.manic.trade/pm — Trending is the default sort.
2. Locate the US Open ATP: Jaime Faria vs Carlos Alcaraz card in the grid.
3. Note the 100.0% price and the enabled Y / N buttons.
4. Click the card.

**Actual result**
The event page shows OUTCOME: CARLOS ALCARAZ, status Resolved, order book Market Ended.

**Expected result**
Resolved markets filtered out of Trending, or displayed with a Resolved badge and disabled
order controls.

**Frequency:** reproduced on two separate page loads.

---

## 6 — F-10 · P2

**Type:** Bug
**Title:** /pm window load event takes 94 to 136 seconds; 113 separate JS chunks requested

**Description**
Two consecutive cold loads of /pm took 94 s and 136 s to reach the window load event, with
the screen showing only the Manic logo and a spinner for most of that. Time to first byte
was 55-56 ms in both cases, so this is not server latency. A control load of
polymarket.com on the same machine and connection minutes later reached DOMContentLoaded
in 1.3 s.

**Steps to reproduce**
1. Open https://app.manic.trade/pm with a cold cache.
2. In the console, run:
   performance.getEntriesByType('navigation')[0]

**Actual result**
Load 1 — TTFB 56 ms, DOMContentLoaded 1,653 ms, loadEventEnd 94,029 ms
Load 2 — TTFB 55 ms, DOMContentLoaded 4,817 ms, loadEventEnd 135,689 ms
Control, polymarket.com, same session — TTFB 181 ms, DOMContentLoaded 1,349 ms
performance.getEntriesByType('resource') counts 113 _next/static/chunks/*.js requests and
250 resources in total. About 100 of those chunks each report roughly 84 s of wall time and
resolve together, which is the signature of connection-pool saturation rather than any one
slow response.

**Expected result**
A trading screen that reaches interactive in single-digit seconds.

**Note:** measured from Indonesia on a residential connection. Absolute numbers will differ
elsewhere; the ratio against the same-session Polymarket control is the reproducible part.

**Frequency:** both cold loads attempted.

---

## 7 — F-12 · P3

**Title:** Choosing a category silently clears the active search query

**Steps:** 1. On /pm type "bitcoin" into Search markets — nine Bitcoin markets render.
2. Click the Politics category chip.

**Actual:** the search input is emptied and the query dropped with no notice. Verified in the
DOM: both input[placeholder="Search markets"] elements return value === "".

**Expected:** search composes with the category filter, or the app says the query was cleared.

---

## 8 — F-14 · P3

**Title:** Empty state offers no way to clear the filter that produced it

**Steps:** 1. On /pm open Politics. 2. Select the Colombia Election subcategory, count 0.

**Actual:** the grid shows only "No markets in this category". No clear-filter or show-all
control exists anywhere on the screen — scanning the rendered text for clear|reset|show all
returns nothing. At 375x812 this is worse: the subcategory rail scrolls horizontally, the
selected chip sits off-screen right, and the visible portion reads
"All 2605 · Trump 298 · Midterms 1138 · Globa…". A mobile user sees an empty screen with no
indication of what caused it and no control to undo it.

**Expected:** an empty state that names the active filter and offers a one-tap reset.

---

## 9 — F-15 · P3

**Title:** 58 zero-size controls stay in the keyboard tab order

**Actual:** on /pm, 58 button / a / input elements have a 0x0 bounding box while remaining
enabled and focusable. They are the collapsed half of the responsive layout, hidden by zero
sizing rather than display:none or hidden. Reproduce with:

[...document.querySelectorAll('button,a,input')]
  .filter(e => { const r = e.getBoundingClientRect();
    return r.width === 0 && r.height === 0 && e.tabIndex >= 0 && !e.disabled }).length
// 58

A keyboard user tabs through 58 invisible stops with no focus ring before reaching the
market grid. Separately, 23 of the 25 img elements on the page have no alt attribute,
including every market thumbnail.

**Expected:** the inactive layout removed from the accessibility tree and the tab order.

---

## 10 — F-07 · P3

**Title:** Every prop label repeats the full event title, so all 26 truncate identically

**Actual:** on the US Open ATP event page each Props rail entry is named with the whole
event title prepended — "US Open ATP: Jaime Faria vs Carlos Alcaraz Total Sets: O/U 3.5",
"…Set 1 Winner", "…Set 1 O/U 8.5", "…Game Spread +/-6.5". Rendered in the rail they all
truncate to "US Open ATP: Jaime Faria vs Carl…", so the distinguishing part is exactly the
part that gets cut. Twenty-six props render as visually identical rows. The same duplicated
label also appears as the outcome name inside a grid card already titled with that event.

**Expected:** strip the event title from the market label wherever the event title is
already on screen: "Total Sets: O/U 3.5", "Set 1 Winner", "Set 1 O/U 8.5".

---

## 11 — F-16 · P3

**Title:** Primary nav still reads "August Rewards" on 3 September

**Actual:** the highlighted nav call to action reads "August Rewards" with the browser clock
at 2026-09-03T04:26:35Z. The panel behind it advertises a Monthly Tournament and a Free
Friday promotion.

**Expected:** a monthly promotion label that tracks the current month, or September's
tournament in its place. As it stands, either the label is a month stale or the app is
promoting a closed campaign as its most prominent header item.

---

## 12 — F-06 · P3

**Title:** One percentage in 35 is formatted to a decimal place, the rest are integers

**Actual:** on a single render of /pm, 35 distinct percentages are displayed; 34 are integers
and exactly one is "100.0%". Sample from document.body.innerText:
["90%","10%","52%","48%","53%","25%","12%","85%","15%","42%","22%","100.0%","17%","16%","50%", …]
Suggests a special case in the rounding path at the 100% boundary.

**Expected:** one precision rule for every outcome price.

---

## 13 — F-08 · P3

**Title:** Zero volume renders as "-- Vol" instead of "$0"

**Actual:** twelve props on the US Open ATP event page show "-- Vol" where neighbours show
"$4K Vol", "$116 Vol", "$1K Vol".

**Expected:** "$0". As it stands the user cannot tell "no trades yet" from "failed to load".

---

## 14 — F-09 · P3

**Title:** Landing-page hero assets preloaded on the trading route and never used

**Actual:** /pm issues link rel=preload for two marketing images the route never renders.
Chrome logs it directly:
"The resource https://app.manic.trade/landing-v2/hero-video-fallback.png was preloaded using
link preload but not used within a few seconds from the window's load event."
Same message for landing-v2/hero-kv-first-frame.jpg. Both are fetched at high priority and
compete with the JavaScript the trading screen actually needs — see the 113-chunk count in
the performance report.

**Expected:** preload only assets the route renders.

---

## 15 — F-11 · P3

**Title:** Same candidate spelled two ways in one viewport

**Actual:** visible simultaneously on /pm — "Republican Presidential Nominee 2028" lists the
outcome as "J.D. Vance"; "Presidential Election Winner 2028" lists the same person as
"JD Vance".

**Expected:** one canonical rendering, so search and favourites match across markets.

---

## 16 — F-13 · P3

**Title:** Subcategories with a count of zero are offered as selectable filters

**Actual:** the Politics subcategory rail lists "Colombia Election 0". It is selectable and
yields "No markets in this category".

**Expected:** a subcategory whose own count is 0 should be hidden or disabled.

---

## 17 — F-17 · P3 — file only if you can reproduce it

**Title:** Click on empty grid area triggered a silent clipboard write

**Actual:** while clicking an empty region of the market grid at the 375x812 viewport, the
page fired a copy handler and overwrote the OS clipboard, with no visible copy control under
the cursor and no confirmation.

**Caveat:** not reproduced a second time and the triggering element was not identified.
Silent clipboard writes on a trading surface are worth a look — a user part-way through
pasting a wallet address would lose it. Try to reproduce before submitting; the bounty
rejects reports that cannot be verified.

---

## Screenshot checklist

The form asks for screenshots or recordings. Capture these before submitting:

- F-02 — one frame containing both the 100%/0% outcome block and the 9%/92% chart legend
- F-01 — address bar showing /pm typed, then the resulting /pm/event/… URL; plus the
  localStorage entry in DevTools Application → Local Storage
- F-03 — the Settlement Time field alongside the Resolved badge and FT 2 - 6 score
- F-04 — the Yankees card with the "--" price and both buttons enabled
- F-05 — the Trending grid card at 100.0% next to the opened event showing Market Ended
- F-10 — the DevTools Network panel or the console output of
  performance.getEntriesByType('navigation')[0]
- F-12 — before and after: search results, then the cleared box after clicking Politics
- F-14 — the empty state at 375x812 with the subcategory rail scrolled as it lands
- F-15 — console output of the zero-size filter snippet
- F-07 — the Props rail with every row truncated to the same string
- F-16 — the nav CTA next to a visible clock or the console output of new Date()

Everything in this pack was observed in a logged-out guest session. No account was used,
no funds were deposited, and no orders were placed.
