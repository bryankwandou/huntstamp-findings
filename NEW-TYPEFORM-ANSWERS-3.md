# Typeform — fourth batch, ten more submissions, written out in full

Same form: https://form.typeform.com/to/TzfbvaPZ

Findings 32 to 41, from a data-integrity sweep of the public events API on 5 September.
Every field is filled. These are submissions 32 through 41.

## The answers identical on all ten

**What device and browser were you using?**
```
Desktop PC / Windows 11 build 26200 / Node.js https client against the public events API / no wallet connected (logged-out guest session)
```

**When did it happen?**
```
September 5, 2026, 01:00-02:30, UTC
```

**Consent questions** → **A. I accept** on both.

---
---

# 32 · F-32

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
194 markets carry a final or in-play score while still flagged acceptingOrders, and one verified live shows a finished match (period FT) still open for orders at an ask of 1.0.
```

**How often does this happen?** → **A. Every time**

> Answer "Every time" for the market I verified live: the finished-match state persisted on every fetch during the capture window. Across the full crawl it was 194 of 6,519.

**How do you think this could be improved?**
```
Stop accepting orders the moment a market has a settled result. Gate acceptingOrders on the
same signal that sets the final score, so a decided market cannot be traded while settlement
is pending.
```

**Anything else you would like to add?**
```
Reproduction. Read the public events API and look for events whose score is set while
acceptingOrders is still true:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=sports&sort=trending&limit=500&offset=0&lite=true"

Then find slug wta-pegula-fernand-2026-09-04. Verified live at capture time:

  score.period    : FT        (full time - the match has finished)
  score.raw       : 1-6, 6-4, 6-3   (Pegula won in three sets)
  closed          : false
  status          : live
  acceptingOrders : true      <- still true on a finished match
  outcome chance  : 0.9995    bestBid 0.999  bestAsk 1.0

Across 6,519 distinct events scanned, 194 carried a score while still accepting orders.
Examples: cs2-furia-vit-2026-09-04 (period 2/3, live 3-7), atp-bublik-paul-2026-09-04
(S3, 4-6 6-3 0-0), fl1-lyo-aja-2026-09-04 (2H, 3-1).

Expected result. A market with a known result does not accept new orders.

What I am and am not claiming. The API advertises these markets as accepting orders. This
session was logged out with no funds, so I did not place an order and I am not asserting what
happens on submit - only what the data plainly states, which anyone can confirm with the same
GET. The reason this matters on a real-money venue is that order acceptance on a decided market
is the setup for a trade against an outcome that is no longer uncertain.

Related and filed separately: settled markets that still advertise a future settlement date,
and a third of dated markets closing exactly seven days after their match.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce (API origin bo-server-api.manic.trade)
```

---

# 33 · F-33

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
338 markets whose end timestamp has already passed are still flagged acceptingOrders and not closed.
```

**How often does this happen?** → **B. Sometimes**

> 338 of 6,519 is about 5%, so "Sometimes" is the honest answer rather than "Every time".

**How do you think this could be improved?**
```
Treat endTs as a hard stop: once it passes, stop accepting orders and move the market into a
settling state, rather than leaving it open until a separate close signal arrives.
```

**Anything else you would like to add?**
```
Reproduction. From the same events API, compare endTs against the current time:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=sports&sort=trending&limit=500&offset=0&lite=true"

Actual result. 338 of 6,519 events had endTs in the past while acceptingOrders was still true
and closed was false. Examples, all ended within the day of capture:

  fl1-lyo-aja-2026-09-04                     acceptingOrders=true
  spl-abh-ett-2026-09-04-more-markets        acceptingOrders=true
  tur-iba-gal-2026-09-04                     acceptingOrders=true

Expected result. An expired market is not open for orders.

This overlaps F-32 but is a distinct signal: F-32 keys on a score being present, this one keys
purely on the clock. Some markets trip one and not the other, which is itself worth a look -
score and end time are not agreeing on whether a market is over.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 34 · F-34

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
81 events advertise an end timestamp that falls before their own start timestamp.
```

**How often does this happen?** → **B. Sometimes**

**How do you think this could be improved?**
```
Validate that endTs is after gameStartTs when a market is created or ingested, and reject or
flag the ones that are not rather than publishing them.
```

**Anything else you would like to add?**
```
Reproduction. From the events API, compare gameStartTs and endTs on each event:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=politics&sort=trending&limit=500&offset=0&lite=true"

Actual result. 81 events had endTs earlier than gameStartTs. Examples:

  republican-presidential-nominee-2028    end is 12 hours before start
  democratic-presidential-nominee-2028    end is 12 hours before start
  brazil-presidential-election            end is 12 hours before start

Expected result. A market ends after it begins.

Why it matters. Any countdown, sorting by time remaining, or "ends in" label built on these
two fields produces nonsense for these markets, and it points at missing validation on the
ingest path rather than a display bug.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 35 · F-35

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
47 outcomes are marked active=false yet still carry acceptingOrders=true.
```

**How often does this happen?** → **B. Sometimes**

**How do you think this could be improved?**
```
Make acceptingOrders depend on active, so an inactive outcome cannot advertise itself as
orderable. If the two are meant to be independent, document what an inactive-but-orderable
outcome is supposed to mean.
```

**Anything else you would like to add?**
```
Reproduction. From the events API, inspect each outcome's active and acceptingOrders flags:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=politics&sort=trending&limit=500&offset=0&lite=true"

Actual result. 47 outcomes across the crawl had active=false with acceptingOrders=true.
Examples:

  republican-presidential-nominee-2028   outcome "Robert F. Kennedy Jr."   active=false accepting=true
  mlb-most-home-runs-team-...            outcome "Team D"                   active=false accepting=true
  saint-petersburg-parliament-...        outcome "Other"                    active=false accepting=true

Expected result. An inactive outcome is not orderable.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 36 · F-36

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
55 markets report a 24-hour volume larger than their all-time volume, which is impossible since the day is part of all time.
```

**How often does this happen?** → **B. Sometimes**

**How do you think this could be improved?**
```
Compute volume24h as a window over the same series that produces the all-time volume, so the
former can never exceed the latter. The small overshoots suggest the two are accumulated from
different sources that drift apart.
```

**Anything else you would like to add?**
```
Reproduction. From the events API, compare volume24h against volume, at both outcome and event
level:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=sports&sort=trending&limit=500&offset=0&lite=true"

Actual result. 30 outcomes and 25 events reported volume24h > volume. Examples:

  outcome  spl-abh-ett-...  Al Ettifaq O/U 0.5   volume=999.996  volume24h=1004.996
  event    cs2-nicetr-33-2026-09-04              volume=743.607  volume24h=868.607

Expected result. 24-hour volume never exceeds all-time volume.

The overshoots are small, so this is a data-consistency bug rather than a large mispricing,
but on a venue where volume is a trust and liquidity signal it should not be able to go
backwards.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 37 · F-37

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
There is no security.txt at either well-known location, so a researcher who finds a vulnerability has no published way to report it privately.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Publish /.well-known/security.txt per RFC 9116 with a contact and a disclosure policy. It is a
few lines of static text and it is exactly what lets someone reach you before they go public.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sI https://app.manic.trade/.well-known/security.txt   -> HTTP 404
  curl -sI https://app.manic.trade/security.txt                -> HTTP 404

Expected result. A security.txt naming a contact and policy.

For contrast, robots.txt and sitemap.xml are both present and correct, so the well-known
mechanism is understood - the security contact is just missing. On a live financial service
this is the difference between a finding reaching you quietly and it reaching you some other
way.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 38 · F-38

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
/manifest.json and /favicon.ico both return HTTP 404 whose body is 1.5 MB of the application HTML shell, served as text/html.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Serve a real web app manifest and a real favicon at these paths, or at least return a small,
correctly-typed 404. Answering a manifest or icon request with 1.5 MB of HTML is wrong on both
the status and the content type.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sI https://app.manic.trade/manifest.json   -> HTTP 404, content-type text/html, 1,512,158 bytes
  curl -sI https://app.manic.trade/favicon.ico      -> HTTP 404, content-type text/html, 1,512,158 bytes

Expected result. A valid manifest (application/json) and icon (image/x-icon), or a small typed
404.

Why it matters. A site that links a manifest but answers /manifest.json with an HTML 404 cannot
be installed as a PWA, and every crawler or browser that requests the favicon downloads 1.5 MB
of the wrong content type. This is the same oversized-soft-404 behaviour I reported for invented
routes, here hitting two files the browser itself requests on every visit.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 39 · F-39

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
On the 5-minute Bitcoin and Ethereum up/down markets, the displayed chance sits 22 points away from the mid of the live order book.
```

**How often does this happen?** → **C. It only happened once**

> Two markets showed it in one crawl, both the same 5-minute crypto product. Filing as "only happened once" because it is a single narrow instance, not a pattern across the venue.

**How do you think this could be improved?**
```
Derive the displayed chance from the same order book the trade executes against, or state which
source it comes from, so the number a user reads matches the price they would actually get.
```

**Anything else you would like to add?**
```
Reproduction. From the events API, compare each outcome's chance against the mid of its bestBid
and bestAsk:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=crypto&sort=trending&limit=500&offset=0&lite=true"

Actual result:

  btc-updown-5m-1788546000   chance 0.825 (82%)   book mid 0.605 (60%)   gap 22 points
  eth-updown-5m-1788546000   chance 0.795 (79%)   book mid 0.575 (57%)   gap 22 points

Expected result. The displayed probability agrees with the order book it trades against.

Why it matters. These are the fastest-settling markets on the venue, where a 22-point gap
between the number shown and the book is the difference between the bet a user thinks they are
making and the one they get.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 40 · F-40

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
Every market image on the venue - 6,521 of 6,521 - is hotlinked directly from Polymarket's public S3 bucket rather than a Manic origin.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Proxy or mirror the images through a Manic origin or CDN. That removes the third-party
dependency, stops leaking each visitor's IP to an external bucket, and gives you a fallback if
the upstream objects move.
```

**Anything else you would like to add?**
```
Reproduction. From the events API, read the image host on every event:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=sports&sort=trending&limit=500&offset=0&lite=true"

Actual result. One distinct image host across all 6,521 events scanned:

  polymarket-upload.s3.us-east-2.amazonaws.com   6,521 of 6,521

Expected result. Images served from, or proxied through, a Manic-controlled origin.

Two concrete consequences. Availability: if that bucket rotates keys, removes an object or
blocks hotlinking, every card image on Manic breaks at once with no fallback. Privacy: each
visitor's browser discloses its IP and User-Agent to a third-party AWS bucket on every page,
on a site people reach specifically to trade.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 41 · F-41

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
Nine events render two outcomes with the identical name, so a user cannot tell the two rows apart.
```

**How often does this happen?** → **B. Sometimes**

**How do you think this could be improved?**
```
Disambiguate outcomes that share a name - append the line, the side, or the sub-market - or
merge them if they are genuinely the same market listed twice.
```

**Anything else you would like to add?**
```
Reproduction. From the events API, count outcome names within each event:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=sports&sort=trending&limit=500&offset=0&lite=true"

Actual result. 9 events carried two outcomes with the same name. Examples:

  lol-sen-c9-2026-09-05     "Both Teams Slay a Dragon"  x2
  lol-ot-exe-2026-09-05     "Odd/Even Total Kills"      x2
  dota2-pr1-synaps-2026-09-04  "Ends in Daytime"        x2

Expected result. Each row in a market carries a distinct, identifying label.

Why it matters. Two identical labels in one market give a user no way to know which one they
are buying, which is a placement risk rather than only a cosmetic one.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---
---

## Screenshot uploads for this batch

| Submission | What to attach |
|---|---|
| 32 · F-32 | `F-32-scored-but-open.png` |
| 33 · F-33 | `F-33-past-end-open.png` |
| 34 · F-34 | `F-34-ends-before-start.png` |
| 35 · F-35 | `F-35-inactive-accepting.png` |
| 36 · F-36 | `F-36-volume-impossible.png` |
| 37 · F-37 | `F-37-no-securitytxt.png` |
| 38 · F-38 | `F-38-manifest-favicon.png` |
| 39 · F-39 | `F-39-chance-vs-book.png` |
| 40 · F-40 | `F-40-hotlinked-images.png` |
| 41 · F-41 | `F-41-dup-outcome-name.png` |

All ten are published at https://huntstamp-findings.vercel.app/forms.html in their own
submission block, with the raw capture each was rendered from published beside it under
`evidence/raw/`.
