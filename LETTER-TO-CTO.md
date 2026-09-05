# Letter to the CTO

Two versions. The short one is the email body. The long one is for the case where they
reply asking for detail, or where you want the full account attached from the start.

Both are written to be read by someone who has seen a hundred bounty submissions and is
looking for a reason to stop reading. The withdrawals are near the top on purpose: a
reporter who tells you what they got wrong is easier to trust on what they got right.

---

## Short version — the email body

**Subject:** Stage 0 assessment — 43 findings, one at the edge of your order book, 2 withdrawn

Hello,

I spent the assessment on the Polymarket integration at `app.manic.trade/pm` and filed 42
findings through the Typeform, from five sweeps. Everything is published, with reproduction
steps and captured evidence:

- Report — https://huntstamp-findings.vercel.app
- Every submission, field by field, each with its screenshot — https://huntstamp-findings.vercel.app/forms.html
- Evidence and raw measurement files — https://huntstamp-findings.vercel.app/evidence.html
- Source, including every capture script — https://github.com/bryankwandou/huntstamp-findings

**Read these two things first, because they change how you should read the rest.**

I withdrew two reports rather than file them. One was a mobile interaction failure that
turned out to be my automation harness. The other I had written up as a serious performance
defect — I measured your `/pm` route taking 94 and then 136 seconds to reach its load event.
A later automated run on the same machine and connection loaded it in 1,581 ms. The slow
figures came from my instrumented browser, not your application. Both withdrawals are
documented on the report rather than deleted.

And the whole assessment ran logged out, with no wallet and no funds. So the confirming step
on the finding below — placing a real order — I did not take. It is the one action I would
not do, and it is where a funded tester on your side finishes the case.

**The finding at the edge of your order book — the one worth your morning.**

On matches your own API marks finished (`score.period == "FT"`), the order book stays open and
keeps publishing an executable ask on outcomes that are now impossible. Read-only, no order
placed: of the 12 finished markets in one snapshot, all 12 were still `acceptingOrders`, and
8 carried a buyable losing outcome. Worked example `atc-alt-sb-2026-09-04`, final score 7-0:

- the **Draw** outcome, ask `0.001`, `acceptingOrders: true`
- the exact score **0-0**, ask `0.005`
- **the loser scores first**, ask `0.01`

A 7-0 result makes all three impossible, yet each still carries a buy price. I did not place
an order, so I have not confirmed a fill — I have shown the venue is still quoting buy prices
on decided results. The confirming test is four steps and needs a funded account: fund with
the minimum, buy one of these impossible outcomes at the quoted ask, watch whether it fills
and whether the position settles to zero. **If it fills, real funds bought a worthless token
on a decided market, and that is a P0.** If it is rejected at submit despite the open quote,
the defect is narrower but still real — you are advertising a tradeable price you will not
honour. Full steps are in submission 42.

This did not come from guessing. I pulled your public events API across all fourteen tags —
6,519 distinct events, 10,786 outcomes — and checked each market against itself, against the
others, and against the clock. That sweep also produced: 194 markets carrying a final or
in-play score while still accepting orders, 338 markets past their end time still open, and a
third of dated markets closing exactly seven days after their match. Settlement and order
acceptance on decided markets is the theme, and it recurs at scale.

**Three more from the rendered product:**

- **Settlement information is wrong on settled markets.** A resolved market with a final score
  on screen still advertises a settlement date a week in the future, and the same wrong date is
  in the `og:description`, so shared links advertise settled markets as still open.
- **`/pm` stops working as an entry point.** Once any event has been opened, a stored tab in
  `localStorage` reopens it and rewrites the address bar. Anyone following a documentation link
  to `/pm` — the URL in your own brief — lands somewhere else.
- **The application renders inside a third-party iframe.** No `X-Frame-Options`, no CSP
  `frame-ancestors`. I embedded `/pm` from an unrelated origin and the live grid, prices and Log
  In button rendered. Missing control, exposure shown; I did not build an exploit.

The remaining findings are data-integrity, accessibility, security-header and display issues.
They are all on the report with reproduction steps you can run yourself.

The most valuable thing I could do next is the funded pass — the confirming order above, then
deposits, positions and settlement crediting, which is the part I could not reach. If that is
useful, I am ready.

Best regards,
Bryan

---

## Long version — for the reply, or as an attachment

**Subject:** Stage 0 assessment — full account

Hello,

This is the complete account of the assessment. I have put the uncomfortable parts first.

### What I got wrong

I filed 43 findings across six sweeps and withdrew two before submission.

**F-10, withdrawn.** I measured `/pm` reaching `loadEventEnd` at 94,029 ms and then
135,689 ms. I diagnosed connection-pool saturation across 113 JavaScript chunks and wrote it
up as a P2 performance defect. It was my strongest-looking finding, and it was wrong. An
automated Playwright run — same machine, same connection, same route — measured `loadEventEnd`
at **1,581 ms**, TTFB 57 ms, same chunk count. The slow figures were an artefact of the
instrumented browser I was driving. What the evidence does support I refiled as F-27: the
directory downloads 17.4 MB and 8,610 event objects to render 24 cards. That measures response
bodies, not wall-clock time, so it does not depend on my machine.

**A mobile interaction report, withdrawn.** Subcategory chips appeared non-functional at a
375 px viewport. Re-testing showed my automation harness was at fault.

Both are on the report as withdrawals rather than deleted, with the numbers that disproved
them. Two further findings did not reproduce on the newer build and are filed with their
frequency answered honestly as "only happened once".

I also caught one of my own findings mid-draft. My first cut of the order-book analysis below
counted in-play scores — a team leading at halftime — as "decided", and turned up thirteen
markets where the leading side was buyable below $1. That was just live in-play trading, not
free money. Restricting strictly to finished (FT) matches dropped it to zero, and I filed only
what survived that restriction.

### The finding at the edge of the order book

I pulled your public events API — the same endpoint your directory calls — across all fourteen
tags, 6,519 distinct events and 10,786 outcomes, and analysed it read-only. No orders, no
funds, no authentication.

Filtering to events the API itself marks `score.period == "FT"` (the match is over):

- 12 finished markets in the snapshot, **all 12 still `acceptingOrders`**
- 8 of them still publishing an executable ask on a losing or now-impossible outcome
- 14 resting bids still open on finished outcomes

The worked example is `atc-alt-sb-2026-09-04`, which finished 7-0. Its `closed` flag was still
`false`, the event still `acceptingOrders`, and three impossible outcomes still carried a buy
price: the Draw at `0.001`, the exact 0-0 score at `0.005`, and the loser-scores-first at
`0.01`. A 7-0 final makes each of those impossible.

I want to be exact about the boundary. I proved, read-only, that the platform publishes
executable quotes on decided markets. I did **not** place an order — logged out, no funds, and
placing a real order is the one action I would not take. So I have not confirmed a fill. The
confirming test needs a funded account and belongs to your team or a tester:

1. Fund a test account with the minimum USDC.
2. Open a market the API reports as FT and pick an impossible outcome (a Draw after a decisive
   result works well).
3. Place the smallest possible buy order against the quoted ask.
4. Observe whether it fills, and whether the position later settles to zero.

If step 3 fills, real funds bought a worthless token on a decided market — a P0. If it is
rejected despite the open quote, you are advertising a price you will not honour, which is
narrower but still wrong. The fix is the same either way: stop quoting decided markets, gating
`acceptingOrders` at both event and outcome level on the same signal that sets the final score.

### The same theme, at scale

The order-book case is the sharp end of a pattern the API sweep found everywhere:

- **194 markets** carry a final or in-play score while still `acceptingOrders`.
- **338 markets** are past their `endTs` yet still open and not closed.
- **81 events** advertise an `endTs` before their own `gameStartTs`.
- **A third of dated markets** (15 of 45 sampled) close exactly seven days after their match —
  a clean cluster at +7 with 62% correct and nothing in between, which reads like a default
  window applied when the real end time is missing.
- **47 outcomes** are `active: false` while still `acceptingOrders: true`.
- **55 markets** report a 24-hour volume larger than their all-time volume.
- **The paging metadata contradicts itself** on at least one tag: `total` says 384 while 376 are
  served, `hasMore` is false while a higher offset still returns rows, and eight events are
  reachable by no offset at all.

Settlement timing and order acceptance on decided markets is the through-line. On a venue
handling real USDC it is also where the money is.

### What I could not test at all

deposits · order placement · order matching · positions · balances · withdrawals ·
settlement crediting · fee calculation · liquidation · anything requiring authentication

All logged out, no funds. My report covers the surface a logged-out visitor and the public API
expose, which is a larger surface than it sounds — but the funded paths are untested and that
is the honest boundary.

### Method

AI-driven browser automation and direct reads of the public API against the live service: real
page loads, real DOM reads, real timings, real screenshots, real API responses, no manual QA.
Both consent questions on the Typeform were answered accordingly. Manic shipped a new
deployment mid-assessment (`dpl_74W5o38E…` to `dpl_C3bXHquK…`), so every earlier finding was
re-checked against the newer build by an automated pass, and the results table is published.

The evidence for the API findings is not a screenshot of a screen — it is a typeset rendering
of the exact bytes returned, with the raw capture published beside each image and the capture
script in the repository. You can re-run any measurement rather than taking mine on trust.

### The rest of the findings

From the rendered product: settlement dates wrong on settled markets and in their share
metadata; `/pm` failing as an entry point via `localStorage`; a resolved market promoted in
Trending with live buy buttons; prop labels that repeat the event title and truncate
identically; a category click that discards the search query; zero-count filters offered as
selectable; the same candidate spelled two ways on two cards at once.

Infrastructure and hygiene: the application frames in a cross-origin iframe with no
`X-Frame-Options` or CSP; `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and
`Cross-Origin-Opener-Policy` all absent (HSTS is present and correct); no `security.txt` at
either well-known location; `/manifest.json` and `/favicon.ico` answered with a 1.5 MB HTML 404;
any invented market slug served as HTTP 200 with the landing-page title.

Metadata and SEO: the page title and Open Graph tags emitted beyond 256 KB into a 1.5 MB
document — on 60 of 60 sampled pages — so an unfurler that caps its fetch gets a blank card.

Accessibility: no heading elements anywhere on `/pm` or event pages, two `<main>` landmarks per
page, two `<h1>` on `/referral`, 21 of 23 images without alt text, unlabelled controls on the
landing page, and zero-sized controls left in the keyboard tab order.

Content dependency: all 6,521 market images are hotlinked directly from Polymarket's S3 bucket,
which is both an availability dependency and a per-visitor privacy leak.

### What I checked that was sound

A report that lists only faults gives no sense of coverage. The market search handles hostile
input cleanly — markup, SQL-shaped strings, long queries and emoji all returned no results with
nothing executed. Browsing produced zero console errors and zero failing requests across four
routes. All eight complementary price pairs on the directory summed to exactly 100. I went looking
for a pricing bug across every multi-outcome market and did not find one: the volume sort was
correctly monotone on all fourteen tags, and every outcome group — negRisk included — summed
within tolerance of 1. `robots.txt`,
`sitemap.xml`, `canonical`, `og:image` and `twitter:card` are all present and correct. And I
nearly filed a broken Liquidity sort before re-testing showed it was the grid caught mid-load.

### Everything is published

- Report — https://huntstamp-findings.vercel.app
- Evidence, with the raw measurement files — https://huntstamp-findings.vercel.app/evidence.html
- Every submission, field by field — https://huntstamp-findings.vercel.app/forms.html
- Sponsor form values — https://huntstamp-findings.vercel.app/submission.html
- Source, including the capture scripts — https://github.com/bryankwandou/huntstamp-findings

### Offer

The most valuable thing I could do next is the funded pass — the confirming order on the
order-book finding, then deposits, positions and settlement crediting. That is where the
severity is, and it is the part I could not reach. If that is useful to you, I am ready to
start.

Best regards,
Bryan
