# Letter to the CTO

Two versions. The short one is the email body. The long one is for the case where they
reply asking for detail, or where you want the full account attached from the start.

Both are written to be read by someone who has seen a hundred bounty submissions and is
looking for a reason to stop reading. The withdrawals are near the top on purpose: a
reporter who tells you what they got wrong is easier to trust on what they got right.

---

## Short version — the email body

**Subject:** Stage 0 assessment — 22 findings, 2 withdrawn, and what I could not test

Hello,

I spent two days on the Polymarket integration at `app.manic.trade/pm` and filed 22 findings
through the Typeform. Everything is published, with reproduction steps and captured evidence:

- Report — https://huntstamp-findings.vercel.app
- Screenshots and raw measurements — https://huntstamp-findings.vercel.app/evidence.html
- Every submission, field by field — https://huntstamp-findings.vercel.app/forms.html
- Source — https://github.com/bryankwandou/huntstamp-findings

**Two things before the findings, because they change how you should read the rest.**

I withdrew two reports rather than file them. One was a mobile interaction failure that
turned out to be my automation harness. The other I had written up as a serious performance
defect — I measured your `/pm` route taking 94 and then 136 seconds to reach its load event.
A later automated run on the same machine and connection loaded the same route in 1,581 ms.
The slow figures came from my instrumented browser, not from your application. Both
withdrawals are documented on the report rather than deleted.

And the testing was AI-driven browser automation, not manual QA. I ran it logged out, with
no wallet and no funds, so **deposits, order placement, positions, balances, withdrawals and
settlement crediting are all completely untested**. On a venue handling real USDC that is
where your severe defects will be, and nothing in my report touches it.

**The four worth your morning:**

1. **The application renders inside a third-party iframe.** No `X-Frame-Options`, no CSP
   `frame-ancestors`. I embedded `/pm` from an unrelated origin and the live grid, prices and
   Log In button all rendered, with no objection from the browser. I did not build a
   clickjacking exploit and I am not claiming one — but on a venue where a click places an
   order, this is a control you want in place.

2. **A settled market advertises a settlement date a week in the future.** The market shows a
   final score, marks itself Resolved and closes the order book, then displays
   `Settlement Time: Sep 9, 3:00 PM UTC` for a match played on 2 September. The same wrong
   date is in the Open Graph description, so every link shared to Slack or X says the market
   is still open.

3. **`/pm` stops working as an entry point.** Once any event has been opened, a stored tab in
   `localStorage` reopens it and rewrites the address bar. Anyone following a documentation
   link to `/pm` — the URL named in your own bounty brief — lands somewhere else.

4. **Any invented market slug returns HTTP 200.** `/pm/event/aaaaaaaaaaaa` serves 1.5 MB with
   your landing-page title instead of a 404, while neighbouring routes 404 correctly. Search
   engines will index an unbounded space of invalid URLs, and your monitoring cannot tell a
   working market link from a broken one.

The remaining eighteen are display, accessibility and hygiene issues — stale promotional
copy, unlabelled images, no heading elements anywhere on the site, zero-count filters that
cannot return results.

I would be glad to run the same pass against a funded account if that is useful, since that
is where the untested weight sits.

Best regards,
Bryan

---

## Long version — for the reply, or as an attachment

**Subject:** Stage 0 assessment — full account

Hello,

This is the complete account of two days on the Polymarket integration. I have put the
uncomfortable parts first.

### What I got wrong

I filed 24 findings and withdrew two before submission.

**F-10, withdrawn.** I measured `/pm` reaching `loadEventEnd` at 94,029 ms and then
135,689 ms, against a same-session control load of polymarket.com at 1.3 seconds on the same
machine. I diagnosed connection-pool saturation across 113 JavaScript chunks and wrote it up
as a P2 performance defect. It was my strongest-looking finding.

It was wrong. An automated Playwright run, same machine, same connection, same route,
measured `loadEventEnd` at **1,581 ms** with time to first byte at 57 ms and the same chunk
count. The slow figures were an artefact of the instrumented browser I was driving. Your
bounty excludes issues caused by the reporter's own environment, and this belongs in that
category.

**A mobile interaction report, withdrawn.** Subcategory chips appeared non-functional at a
375 px viewport. Re-testing showed my automation harness was at fault, not your interface.

Both are published on the report as withdrawals rather than deleted, with the numbers that
disproved them. I would rather you see the failures than wonder what else I did not check.

Two more findings did not reproduce when I re-tested them against your newer build. They are
filed with their frequency answered honestly as "only happened once" rather than "every
time", so your triage is not surprised.

### What I could not test at all

I ran the entire assessment logged out, with no wallet connected and no funds deposited.
That means none of this was exercised:

deposits · order placement · order matching · positions · balances · withdrawals ·
settlement crediting · fee calculation · liquidation · anything requiring authentication

On a venue handling real USDC, that list is where severe defects live. My report covers the
surface a logged-out visitor can reach, and that is the honest boundary of it.

### Method

AI-driven browser automation against the live application: real page loads, real DOM reads,
real timings, real screenshots, no manual QA pass. Both consent questions on the Typeform
were answered accordingly.

Two sweeps. The first worked through the rendered interface; the second went after the
layers underneath — response headers, routing, document structure, link metadata. Manic
shipped a new deployment between them (`dpl_74W5o38E…` to `dpl_C3bXHquK…`), so every first-sweep
finding was re-checked against the newer build by an automated pass, and the results table is
published.

### The findings that matter

**The application frames.** Neither `X-Frame-Options` nor a CSP `frame-ancestors` directive
is sent on any route. A page served from an unrelated origin embedded `https://app.manic.trade/pm`
and the frame attached, loaded and painted the real application — market grid, live prices,
sort controls, Log In button. The browser raised no framing objection at all.

I want to be precise about what this is and is not. I demonstrated that the page frames, with
a screenshot. I did not build a working clickjacking exploit and did not attempt one, since
that needs an interactive control and a funded session. This is a missing control with the
exposure proven, not a proven end-to-end attack. On a venue where a click places an order, it
is worth closing.

While you are in that file: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
and `Cross-Origin-Opener-Policy` are all absent too. HSTS is present and correct, and
`http://` redirects properly, so the foundations are there.

**Settlement information is wrong on a settled market, in two places.** The event page for a
match played 2 September shows the final score, marks the market Resolved and closes the order
book, then displays `Settlement Time: Sep 9, 3:00 PM UTC`. The same date is served in the
`og:description` as `"$4K traded · Ends Sep 9"`, so every link pasted into Slack, X, Discord or
Telegram advertises a settled market as still open. A user checking when their funds are
released is given a date with no relation to a settlement that already happened.

**The entry point does not hold.** `/pm` stops resolving to the market directory once any
event has been opened. `localStorage['pm-events-store']` restores the stored event and
rewrites the address bar; removing that key restores the directory, which isolates the cause
rather than the symptom. This is the URL named in your own bounty brief.

**Invalid market slugs are served as successful pages.** `/pm/event/anything-at-all` returns
HTTP 200 with 1.5 MB and your generic landing-page title, no canonical. `/pm/nonsense-subroute`
and `/pm/event/` both 404 correctly, so the inconsistency is within your own routing. Three
costs: a user following a dead link is dumped on the directory with no explanation, search
engines are invited to index unlimited invalid URLs as valid, and monitoring cannot
distinguish a working market link from a broken one.

**Nothing on the site is marked up as a heading.** Zero `<h1>`, `<h2>` or `<h3>` elements on
either the directory or an event page, confirmed in the served HTML and again in the hydrated
DOM. Two `<main>` landmarks per page, which is invalid. For a screen-reader user the
heading-jump shortcut — the primary way many people move through a page — does nothing at all
here. Separately, 21 of 23 images carry no alt attribute, and 19 to 58 zero-sized controls
from the inactive responsive layout stay in the keyboard tab order.

The remaining findings are display and hygiene: a resolved market promoted in Trending with
live buy buttons, prop labels that repeat the event title and truncate identically across 48
rows, a category click that silently discards the search query, zero-count filters offered as
selectable, an "August Rewards" promotion still running in September, `-- Vol` where `$0`
belongs, the same candidate spelled two ways on two cards visible at once, and a 404 that
ships 1.44 MB.

### What I checked that was sound

A report that lists only faults gives no sense of coverage, so: the market search handles
hostile input cleanly — markup, SQL-shaped strings, 400-character queries and emoji all
returned no results with nothing executed and no layout break. Browsing the directory and
opening three markets produced zero console errors and zero uncaught exceptions. All eight
complementary price pairs on the directory summed to exactly 100. Your API responses were
prompt, the slowest data call in a full session being 2,313 ms.

One near-miss worth mentioning: the Liquidity sort appeared to return 3 cards where every
other sort returned 24, and I nearly filed it. Re-testing with longer waits showed the grid
climbing 3 → 24 within seconds, and the Volume sort doing the same. My first sample had caught
the grid mid-load.

### Everything is published

- Report — https://huntstamp-findings.vercel.app
- Evidence, with the raw measurement files — https://huntstamp-findings.vercel.app/evidence.html
- Every submission, field by field — https://huntstamp-findings.vercel.app/forms.html
- Sponsor form values — https://huntstamp-findings.vercel.app/submission.html
- Source, including the capture scripts — https://github.com/bryankwandou/huntstamp-findings

The capture scripts are in the repository so you can re-run any measurement yourself rather
than taking mine on trust.

### Offer

The most valuable thing I could do next is the funded pass — deposits, orders, positions,
settlement. That is where the severity is, and it is the part I could not reach. If that is
useful to you, I am ready to start.

Best regards,
Bryan
