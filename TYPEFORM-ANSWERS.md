# Typeform — all 17 submissions, written out in full

One Typeform submission per finding. Every field below is filled. Nothing is left
for you to compose. Copy the block, paste it, move to the next.

Form: https://form.typeform.com/to/TzfbvaPZ

## Read this before you paste anything

Manic shipped a new build during the session. Findings were observed on deployment
`dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs`; the live build is now `dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce`,
with a new "Discover" item in the nav. I re-tested against the new build at 09:34 UTC.

| Finding | Verified by automated capture on `dpl_C3bXHquK…` |
|---|---|
| F-01 `/pm` hijacked | **Yes** — requested `/pm`, landed on `/pm/event/atp-faria-alcaraz-2026-09-02` |
| F-03 settlement date | **Yes** — `Sep 9, 3:00 PM UTC`, resolved true, marketEnded true, score 2 - 6 |
| F-12 search cleared | **Yes** — both search inputs read `""` after the category click |
| F-16 "August Rewards" | **Yes** — nav reads August at `2026-09-03T09:46:37Z` |
| F-07 prop labels | **Yes, larger** — 48 rows prefixed with the event title, not 26 |
| F-08 `-- Vol` | **Yes** — 13 rows |
| F-09 unused preload | **Yes** — 1 asset, warned 16 times in a single load |
| F-11 name spellings | **Yes** — both `J.D. Vance` and `JD Vance` present |
| F-15 zero-size controls | **Partly** — 19 this run, not 58; the count is unstable |
| F-02 contradictory prices | **No** — see the correction on submission 01 |
| F-06 decimal percentage | **No** — 33 percentages, none with a decimal |
| **F-10 slow page load** | **WITHDRAWN — do not submit.** See below. |

### F-10 is withdrawn

I measured `loadEventEnd` at 94,029 ms and 135,689 ms through an instrumented browser pane
and reported it as a defect. An automated Playwright run on the same machine and connection
then loaded the same route with `loadEventEnd` at **1,581 ms**, TTFB 57 ms, DOMContentLoaded
1,193 ms, with the same 115 JS chunks.

The slow figures were an artefact of my test environment, not of the application. The bounty
excludes issues caused by the reporter's own device or network, and submitting this would be
both wrong and damaging to the other sixteen reports. Skip submission 03 entirely.

The chunk count itself — 115 requests on one route — stands as an observation, but it is not
a bug on this evidence and is not worth a submission.

Everything else was not re-tested against the new build. Where a submission says
"Every time", that claim rests on the original build unless the table above says otherwise.

## The two answers that are identical on all 17

**What device and browser were you using?**
```
Desktop PC / Windows 11 build 26200 / Chromium 148.0.7778.280 / no wallet connected (logged-out guest session)
```

**When did it happen?**
```
September 3, 2026, 04:00-04:30, UTC
```

## The two consent questions, on all 17

**"I have not included passwords, private keys, or seed phrases…"** → **A. I accept**
All three statements hold for this session: nothing secret was included, nothing was
exploited repeatedly or disclosed publicly, and Manic is welcome to reproduce and follow up.

**"i create with ai, no manual testing."** → **A. I accept**
This is accurate. The testing ran through AI-driven browser automation against the live
application — real page loads, real DOM reads, real performance timings — with no manual
QA pass and no funded account. Every finding carries steps Manic's own team can run.

---
---

# 01 · F-02

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
A settled market displays two contradictory price sets at once, and one of the pairs sums to 101%.
```

**How often does this happen?** → **C. It only happened once**

> Answer "It only happened once", not "Every time". I re-tested this event on the newer
> build at 09:34 UTC and both readouts now agree at 0% / 100%; the 9% / 92% legend is gone.
> Claiming "Every time" would fail triage on the first attempt and would cast doubt on the
> other sixteen submissions. The evidence below is verbatim and the build id is stated, so
> the report still stands on its own terms.

**How do you think this could be improved?**
```
Drive the outcome block and the chart legend from one price source, and switch that source
to settlement values the moment a market resolves. Add an invariant that refuses to render
complementary outcomes summing above 100%, so a mismatch fails loudly in staging instead of
quietly in production.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02
2. Read the outcome block at the top of the centre panel.
3. Read the chart legend immediately below it.

Actual result. The right panel reads OUTCOME: CARLOS ALCARAZ, status Resolved, order book
Market Ended. The outcome block reads Carlos Alcaraz 100% and Jaime Faria 0%. The chart
legend directly beneath reads Jaime Faria 9% and Carlos Alcaraz 92%.

Rendered DOM text, verbatim:
Carlos Alcaraz / 100% / Jaime Faria / 0% / Jaime Faria / 9% / Carlos Alcaraz / 92%

9 and 92 sum to 101, which complementary outcomes cannot do, and both contradict a
settlement the same screen declared two lines earlier. The chart tooltip on the final data
point reads Sep 2, 2026, 09:00:16.

Expected result. One price set per market, showing settlement values once resolved.

Why it matters. A trader reading the legend sees a live-looking market quoting an outcome
at 92c that is already worth a dollar. The same defect on a market that had not yet settled
would present a false arbitrage.

Re-test. I checked the same event again at 09:34 UTC on the newer build,
dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce, after waiting for the chart to finish rendering. Both
readouts now agree at Jaime Faria 0% and Carlos Alcaraz 100%, and the 9% / 92% legend is
gone. So either this was fixed between the two builds, or the mismatch only exists in the
window between a market resolving and the settlement price propagating to the chart series.
I could not distinguish those two from the outside. Reporting it anyway, with the build id
and the timestamp, because the capture is verbatim and because the second explanation would
mean the defect is still present and simply hard to catch.

Build observed on: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs, 3 September 2026, ~04:15 UTC
Re-tested on: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce, 3 September 2026, 09:34 UTC
Full report: https://huntstamp-findings.vercel.app
```

---

# 02 · F-01

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
The /pm URL stops opening the market directory once any event has been opened, because a stored tab overwrites the navigation.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Treat an explicit navigation to /pm as an instruction to show the directory. Restore saved
tabs alongside the directory rather than instead of it, and stop rewriting the address bar
to a route the user did not request.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm in a clean profile. The directory renders.
2. Click any event card. The address becomes /pm/event/<slug>.
3. Type https://app.manic.trade/pm in the address bar and press Enter.

Actual result. The event from step 2 is restored and the address bar is rewritten back to
/pm/event/<slug>. The directory never appears.

Root cause. localStorage['pm-events-store'] holds:
{"state":{"category":"all","surface":"catalog","sidebarCollapsed":false,
"openEventIds":["atp-faria-alcaraz-2026-09-02"],"tabMeta":{...}}}
Running localStorage.removeItem('pm-events-store') and reloading restores the directory,
which confirms the cause rather than the symptom.

Expected result. /pm renders the market directory.

Why it matters. This is the entry point named in Manic's own bounty brief. Anyone following
a link to /pm from the docs, the blog or the announcement lands somewhere else. In my
session the restored market was already resolved, so a returning user's first screen was a
dead market.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 03 · F-10

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
The /pm trading screen takes 94 to 136 seconds to finish loading while showing only a spinner.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Bundle the route into far fewer chunks. 113 separate chunk requests saturate the browser's
connection pool, which is what stretches the load rather than any single slow response.
Drop the two landing-page hero preloads from this route at the same time, since they
compete for the same connections and are never rendered here.
```

**Anything else you would like to add?**
```
Measured on two consecutive cold loads of https://app.manic.trade/pm:
Load 1 - TTFB 56 ms, DOMContentLoaded 1,653 ms, loadEventEnd 94,029 ms
Load 2 - TTFB 55 ms, DOMContentLoaded 4,817 ms, loadEventEnd 135,689 ms

Control on the same machine, same connection, same session, minutes apart:
polymarket.com - TTFB 181 ms, DOMContentLoaded 1,349 ms

Read back with performance.getEntriesByType('navigation')[0].

performance.getEntriesByType('resource') counts 113 _next/static/chunks/*.js requests and
250 resources for this one route. Roughly a hundred of those chunks each report about 84
seconds of wall time and resolve together, which is the signature of connection-pool
saturation. A TTFB of 55 ms rules out the server.

During both loads the screen showed only the Manic logo and a three-dot spinner.

Measured from Indonesia on a residential connection, so the absolute numbers will differ
elsewhere. The ratio against the same-session Polymarket control is the reproducible part.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 04 · F-03

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
A market marked Resolved shows a settlement time dated seven days after the event it settles.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Show the actual settlement timestamp on a resolved market, or hide the settlement countdown
entirely once the market has resolved. A future date on a settled market is worse than no
date at all.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02
2. Read the Settlement Time field.

Actual result. Settlement Time: Sep 9, 3:00 PM UTC, while the same page shows status
Resolved, order book Market Ended, and a final score of FT 2 - 6.

The match was played 2026-09-02, which the event slug itself records. The displayed
settlement date is seven days after the match and six days after the date of test.

Expected result. The real settlement timestamp, or no countdown on a resolved market.

Why it matters. A user checking when their funds are released is given a date with no
relation to a settlement that already happened.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 05 · F-04

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
An outcome whose price fails to load renders as "--" while both of its buy buttons stay enabled.
```

**How often does this happen?** → **B. Sometimes**

**How do you think this could be improved?**
```
Disable the Yes and No buttons whenever an outcome has no price, with a visible
"price unavailable" state, or hide that outcome row until a price arrives. An order flow
should never be reachable from a row the interface could not price.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm with the default Trending sort.
2. Find the New York Yankees vs. Los Angeles Angels card.
3. Read the second outcome row.

Actual result. The card rendered:
  O/U 2.5        50%   Y  N
  Extra Innings  --    Y  N
Both Extra Innings buttons were active and clickable with no price shown.

A later reload priced the same card normally, showing O/U 2.5 at 78% and O/U 4.5 at 84%.
The missing price is therefore transient rather than permanent, which makes it easier for a
user to walk into rather than harder.

Expected result. No live order controls on an outcome with no price.

Why it matters. On a real-money venue, an order flow reachable from an unpriced outcome is
the setup for an order placed at a price the user never saw.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 06 · F-05

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
A resolved market stays in the default Trending feed with both buy buttons rendered as live controls.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Filter resolved markets out of Trending, or render them with a Resolved badge and disabled
order controls so the state is visible before the click rather than after it.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm. Trending is the default sort.
2. Find the card "US Open ATP: Jaime Faria vs Carlos Alcaraz Total Sets: O/U 3.5".
3. Note the 100.0% price and the enabled Y and N buttons.
4. Click the card.

Actual result. The event page shows OUTCOME: CARLOS ALCARAZ, status Resolved, and an order
book reading Market Ended. Reproduced across two separate page loads.

Expected result. Resolved markets excluded from Trending, or clearly badged with their
order controls disabled.

Why it matters. The integration's first discovery surface is promoting markets nobody can
trade, which wastes the click and undercuts trust in the rest of the feed.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 07 · F-12

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
Selecting a category silently empties the search box and discards the active query.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Compose the two filters: run the existing query inside the newly chosen category. If the
product intends the query to be dropped, say so in the interface rather than clearing the
field without a word.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm
2. Type bitcoin into Search markets. Nine matching Bitcoin markets render.
3. Click the Politics category chip.

Actual result. The search input is emptied and the query is discarded with no notice. The
grid shows Politics markets as though nothing had been typed. Verified in the DOM: both
input[placeholder="Search markets"] elements return value === "".

Expected result. Either the query runs within Politics, or the interface states that the
search was cleared.

Why it matters. A user narrowing a broad result set by category loses their query at the
exact moment they were refining it, and has to retype from scratch.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 08 · F-14

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
The empty-results screen offers no control to clear the filter that produced it, and on mobile the responsible filter is scrolled off-screen.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Name the active filter in the empty state and give it a one-tap reset. On narrow viewports,
scroll the selected chip into view so the user can see which filter is responsible.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm and select the Politics category.
2. In the subcategory rail, select Colombia Election, which shows a count of 0.

Actual result. The grid renders only the sentence "No markets in this category". No clear,
reset or show-all control exists anywhere on the screen. Scanning the rendered text for
clear, reset or show all returns nothing.

At the 375x812 viewport this is worse. The subcategory rail is a horizontal scroller and
the selected chip sits off-screen to the right; the visible portion reads
"All 2605 - Trump 298 - Midterms 1138 - Globa...". A mobile user sees an empty screen, no
indication of which filter caused it, and no control to undo it.

Expected result. An empty state that names the active filter and offers a one-tap reset.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 09 · F-15

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
Controls from the inactive responsive layout stay enabled and focusable at zero size, putting 19 to 58 invisible stops in the keyboard tab order.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Render one responsive layout at a time, or hide the inactive one with display:none or the
hidden attribute rather than collapsing it to zero size. Zero-sized elements stay in the
accessibility tree and the tab order; hidden ones do not. While in that code, add alt text
to the market thumbnails.
```

**Anything else you would like to add?**
```
Reproduction. Open https://app.manic.trade/pm, open the console and run:

[...document.querySelectorAll('button,a,input')]
  .filter(e => { const r = e.getBoundingClientRect();
    return r.width === 0 && r.height === 0 && e.tabIndex >= 0 && !e.disabled }).length

Actual result. Returned 58 on the first build. A later automated run on the newer build
returned 19, with 21 of 23 images lacking alt text. The exact count moves with viewport and
render state; what is stable is that the inactive responsive layout stays focusable. Sample innerText from those elements includes
"Monthly TournamentReal...", "Free Friday$200100 Dem...", "All", "Crypto", "Politics",
"August Rewards" and "Log In" - the collapsed half of the responsive layout. The desktop
header and category rail stay in the DOM at mobile widths and vice versa, hidden by zero
sizing rather than by display:none.

A keyboard user passes 58 stops with no visible focus indicator before reaching the first
market card.

Related, from the same page: 23 of the 25 img elements carry no alt attribute, including
every market thumbnail. Check with
[...document.querySelectorAll('img')].filter(i => !i.alt).length

Expected result. Only the active layout in the tab order.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 10 · F-07

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
Every prop market label repeats the full event title, so all 26 props in the rail truncate to the same unreadable string.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Strip the event title from the market label in any context that already displays the event
title. The rail should read "Total Sets: O/U 3.5", "Set 1 Winner", "Set 1 O/U 8.5" rather
than repeating the match name in front of each one.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02
2. Read the Props rail on the left.

Actual result. Each entry is named with the whole event title prepended:
  US Open ATP: Jaime Faria vs Carlos Alcaraz Total Sets: O/U 3.5
  US Open ATP: Jaime Faria vs Carlos Alcaraz Set 1 Winner
  US Open ATP: Jaime Faria vs Carlos Alcaraz Set 1 O/U 8.5
  US Open ATP: Jaime Faria vs Carlos Alcaraz Game Spread +/-6.5
Rendered in the rail these all truncate to "US Open ATP: Jaime Faria vs Carl...", so the
part that distinguishes one prop from another is exactly the part that disappears. An automated pass counted 48 rows carrying that prefix; they render as visually identical
rows.

The same duplicated label also appears as the outcome name inside a grid card whose title is
already that event.

Expected result. Labels that identify the prop rather than repeating the event.

Why it matters. The props list cannot be scanned. Each row has to be opened individually to
find out what it is.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 11 · F-16

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
The most prominent nav call to action still reads "August Rewards" on 3 September.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Drive the promotion label from the current period rather than a hardcoded month, and have
it roll over automatically when the tournament does.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm
2. Read the highlighted call to action in the primary nav.
3. In the console, run new Date().toISOString() to confirm the current date.

Actual result. The nav reads "August Rewards" with the browser clock at
2026-09-03T04:26:35Z. The panel behind it advertises a Monthly Tournament and a Free Friday
promotion.

Expected result. A monthly promotion label that follows the current month, or September's
tournament in its place.

Why it matters. Either the label is a month stale, or a closed campaign is the loudest item
in the header. Either way the first thing a user reads is wrong.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 12 · F-06

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
A price of exactly 100% renders as "100.0%", carrying a trailing decimal that no other whole-number price on the screen shows.
```

**How often does this happen?** → **B. Sometimes**

**How do you think this could be improved?**
```
Strip the trailing .0 when a price lands on a whole number, so 100.0% renders as 100% and
matches every other integer price. The fractional case is fine as it stands.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm
2. In the console, run:
   [...new Set(document.body.innerText.match(/\d+(\.\d+)?%/g))]

Actual result, first build. 35 distinct percentages, 34 of them integers, and exactly one
rendered as 100.0%:
["90%","10%","52%","48%","53%","25%","12%","85%","15%","42%","22%","100.0%","17%","16%",
"50%","62%","38%","59%","39%","55%","43%","98%","2%","80%","18%", ...]

Correction after re-testing. On the newer build, dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce, the same
snippet returned 32 percentages with exactly one decimal value, 99.5%. That one is correct:
99.5 is not a whole number and needs the decimal. So the formatter's rule appears to be
"show one decimal where the value is fractional", and the actual defect is narrower than my
first reading: a value of exactly 100 was rendered as 100.0% rather than 100%.

I did not catch 100.0% again on the newer build, so the frequency is answered as Sometimes.

Build observed on: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
Re-tested on: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 13 · F-08

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
Zero volume renders as "-- Vol" instead of "$0", so a user cannot tell no trades from a failed load.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Render zero volume as $0 and reserve the dash for a genuine load failure, so the two states
are distinguishable at a glance.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02
2. Read the volume figures down the Props rail.

Actual result. Twelve props show "-- Vol" while their neighbours show "$4K Vol",
"$116 Vol", "$1K Vol", "$9K Vol", "$13K Vol". The props showing a dash include Set 1 O/U
8.5, Set 1 O/U 9.5, Set 3 O/U 8.5, Set 2 O/U 8.5, Set 2 O/U 9.5, Set 1 O/U 10.5, Set 4
Winner, Set 2 O/U 10.5, Set 3 O/U 9.5, Set 3 O/U 10.5, Set 4 O/U 8.5, Set 4 O/U 9.5 and
Set 4 O/U 10.5.

Expected result. $0 where volume is zero.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 14 · F-09

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
Two landing-page hero images are preloaded at high priority on the trading route and never used.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Preload only assets the route actually renders. These two belong to the marketing landing
page and compete for connections with the JavaScript the trading screen needs.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm
2. Read the browser console.

Actual result. Chrome reports the waste without prompting:

"The resource https://app.manic.trade/landing-v2/hero-video-fallback.png was preloaded
using link preload but not used within a few seconds from the window's load event."

"The resource https://app.manic.trade/landing-v2/hero-kv-first-frame.jpg was preloaded
using link preload but not used within a few seconds from the window's load event."

On the newer build the same warning was emitted 16 times in a single page load, for
hero-video-fallback.png. Both assets belong to the marketing landing page and neither is
rendered on the trading route.

Expected result. No preloads for assets the route does not render.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 15 · F-11

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
The same candidate is spelled "J.D. Vance" on one card and "JD Vance" on another card visible at the same time.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Normalise outcome names against a single canonical form so search, favourites and any future
cross-market grouping match across markets.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm
2. Locate the cards "Republican Presidential Nominee 2028" and "Presidential Election
   Winner 2028". Both are visible in the default Trending grid at the same time.

Actual result. The first lists the outcome as "J.D. Vance". The second lists the same person
as "JD Vance".

Expected result. One canonical rendering of the name.

Why it matters. A user searching or favouriting one spelling will not match the other.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 16 · F-13

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
Subcategories with a market count of zero are offered as selectable filters that are guaranteed to return nothing.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Hide a subcategory whose own count is zero, or render it disabled. The count is already
computed and displayed, so the condition is available at render time.
```

**Anything else you would like to add?**
```
Reproduction:
1. Open https://app.manic.trade/pm and select the Politics category.
2. Read the subcategory rail. It lists "Colombia Election 0".
3. Select it.

Actual result. The filter applies and the grid shows "No markets in this category". The rail
displays the count of 0 next to the label, so the interface knows in advance that selecting
it cannot return a result.

Expected result. Zero-count subcategories hidden or disabled.

Related: once selected, there is no control anywhere on screen to clear the filter. That is
filed separately.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---

# 17 · F-17

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
A click on empty space in the market grid fired a copy handler and overwrote the operating system clipboard.
```

**How often does this happen?** → **C. It only happened once**

**How do you think this could be improved?**
```
Scope copy handlers to the elements that own them rather than to a container. A silent
clipboard write from blank space is worth ruling out even if it turns out to be narrow.
```

**Anything else you would like to add?**
```
Observed once, at the 375x812 viewport, while clicking an empty region of the market grid on
https://app.manic.trade/pm. The page fired a copy handler and the operating system clipboard
was overwritten, with no visible copy control under the cursor and no confirmation.

I could not reproduce it a second time and I did not identify the element responsible, so I
am filing this as an observation rather than a confirmed defect. Treat the frequency answer
accordingly.

Reporting it because a silent clipboard write on a trading surface has a specific cost: a
user part-way through pasting a wallet address or a deposit address would lose it without
noticing.

Build: dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs
```

---
---

## The screenshot upload

The upload field is mandatory on every submission and it is the one thing here that cannot
be written for you — producing an image of evidence I did not photograph would be
fabricating evidence, which is exactly what the reviewers are checking for.

On Windows, `Win + Shift + S` captures a region.

| Submission | Frame to capture |
|---|---|
| 01 · F-02 | The outcome block and the chart legend together in one frame |
| 02 · F-01 | `/pm` typed in the address bar, the resulting `/pm/event/…`, and the `pm-events-store` entry in DevTools → Application → Local Storage |
| 03 · F-10 | Console output of `performance.getEntriesByType('navigation')[0]` |
| 04 · F-03 | Settlement Time beside the Resolved badge and the FT 2 - 6 score |
| 05 · F-04 | The Yankees card showing `--` with both buttons enabled |
| 06 · F-05 | The Trending card at 100.0% next to the opened event reading Market Ended |
| 07 · F-12 | Two shots: search results for bitcoin, then the emptied box after clicking Politics |
| 08 · F-14 | The empty state at 375x812 with the rail scrolled as it lands |
| 09 · F-15 | Console output of the zero-size filter snippet returning 58 |
| 10 · F-07 | The Props rail with every row truncated identically |
| 11 · F-16 | The nav CTA beside console output of `new Date()` |
| 12 · F-06 | Console output of the percentage regex showing `100.0%` among integers |
| 13 · F-08 | The Props rail showing `-- Vol` beside `$4K Vol` |
| 14 · F-09 | The two console preload warnings |
| 15 · F-11 | Both 2028 cards in one frame showing the two spellings |
| 16 · F-13 | The rail showing `Colombia Election 0` and the resulting empty grid |
| 17 · F-17 | Skip if you cannot reproduce it, or note in the upload that no capture exists |

The five easiest are 03, 09, 12, 14 and 11 — all are console output. Open DevTools, paste
the snippet, screenshot the result.
