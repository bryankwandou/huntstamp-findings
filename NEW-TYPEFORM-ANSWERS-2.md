# Typeform — third batch, seven more submissions, written out in full

Same form: https://form.typeform.com/to/TzfbvaPZ

Findings 25 to 31, from the sweep on 4 September. Every field is filled. Numbering continues
from the first two batches, so these are submissions 25 through 31.

## The answers identical on all seven

**What device and browser were you using?**
```
Desktop PC / Windows 11 build 26200 / headless Chromium via Playwright and curl / no wallet connected (logged-out guest session)
```

**When did it happen?**
```
September 4, 2026, 08:20-09:00, UTC
```

**Consent questions** → **A. I accept** on both.

---
---

# 25 · F-25

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
The page title and Open Graph tags are emitted at the very end of a 1.5 MB document, so any link unfurler that caps its fetch below about 512 KB receives no title and no description at all.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Emit the title and the Open Graph tags inside <head>, in the first few kilobytes, before the
application payload. On the App Router this usually means resolving generateMetadata without
awaiting the data the page body needs, or streaming the shell after the metadata rather than
before it.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sS https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02 \
    | head -c 262144 | grep -c "<title>"

Actual result: 0. Raise the cap to 524288 and it returns 1.

Measured across 60 event pages sampled from your sitemap:

  pages whose <title> sits beyond 256 KB   60 of 60
  earliest <title> offset seen             501,187 bytes
  latest <title> offset seen               1,534,261 bytes
  pages where <title> appears after </head>  13 of 60

On one page measured byte by byte: <head> opens at 55, </head> closes at 504,898, and <title>
appears at 1,533,738 - 99.9% of the way through the document, inside <body>.

The consequence, measured rather than assumed. Requesting the same page with a Slackbot user
agent and stopping after a fixed number of bytes:

  cap      title                        og:description
  64KB     (none)                       (none)
  128KB    (none)                       (none)
  256KB    (none)                       (none)
  512KB    US Open ATP: Jaime Faria v   Ends Sep 9
  1024KB   US Open ATP: Jaime Faria v   Ends Sep 9

Identical across three consecutive runs.

Expected result. Title and Open Graph tags inside <head>, in the first few kilobytes.

Why it matters. A market link pasted into Slack, X, Discord or Telegram renders as a bare URL
or an empty card wherever the unfurler stops early. The metadata is correct - it is simply
arriving too late to be read.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 26 · F-26

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
One market's share description reads "Completed Match 50% - Ends Sep 11", three statements that cannot all be true at once.
```

**How often does this happen?** → **C. It only happened once**

> Answer "It only happened once" honestly: this appeared in one page of a 60-page sample, and a targeted re-scan of 45 dated markets found no second instance.

**How do you think this could be improved?**
```
Build the description from the market's current state, so a completed market shows its settled
price and its settlement date rather than a midpoint price and a future close.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sS https://app.manic.trade/pm/event/itf-danil-laro-2026-09-04 | grep og:description

Actual result:

  <meta property="og:description" content="$44K traded - Completed Match 50% - Ends Sep 11">

Three statements that cannot all hold. A completed match has an outcome, so it cannot sit at
50%, and it cannot close a week after it finished.

Expected result. A completed market shows its settled price and its settlement date.

Frequency, stated plainly. This appeared once, in a 60-page sample taken from your sitemap.
I then re-scanned 45 dated markets specifically looking for a second instance and found none.
I am filing it as a single observation with the slug recorded, not as a pattern, so your triage
is not surprised if it does not reproduce.

Related and filed separately: about a third of dated markets carry a close date exactly seven
days after their match. This market is one of them.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 27 · F-27

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
Opening the market directory downloads 17.4 MB of API data containing 8,610 events in order to render 24 cards.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Fetch the visible tab only, at the page size actually rendered, and load the remaining
categories when the user selects them. The current first load requests limit=500 for fourteen
tags and paginates each one through offset 0, 500 and 1000 while the user is looking at
Trending.
```

**Anything else you would like to add?**
```
Reproduction. Open https://app.manic.trade/pm with the network panel recording, filter to
bo-server-api.manic.trade, and let the page settle. Measured with no interaction at all:

  API calls                        58
  of those requesting limit=500    22
  distinct category tags queried   14
  total API bytes                  18,246,307  (17.4 MB)
  event objects returned           8,610
  market cards actually rendered   24

The tags fetched: pandemics, science, business, geopolitics, economy, crypto, sports, politics,
elections, pop-culture, weather, world, tech, finance.

Largest responses, each carrying 500 events:

  1,374,646 bytes  /charts/pm/events?tag=sports&sort=trending&limit=500&offset=0&lite=true
  1,358,399 bytes  /charts/pm/events?tag=sports&sort=trending&limit=500&offset=1000&lite=true
  1,354,171 bytes  /charts/pm/events?tag=sports&sort=trending&limit=500&offset=500&lite=true
  1,171,786 bytes  /charts/pm/events?tag=elections&sort=trending&limit=500&offset=0&lite=true

That is 359 event objects downloaded for every card displayed.

Expected result. Bandwidth roughly proportional to what is rendered.

Why it matters. This is bandwidth on a mobile connection, memory in the tab, and load on
bo-server-api.manic.trade, multiplied by every visitor who opens the directory.

One thing I want to be straight about. I earlier reported this route as slow, measuring 94 and
then 136 seconds to the load event, and I withdrew that report: a headless run on the same
machine and connection loaded it in 1,581 ms, so the slow figures were an artefact of my
instrumented browser. This finding is what the evidence actually supports. It measures response
body sizes rather than wall-clock time, so it does not depend on my environment. The route is
not slow - it just moves 17.4 MB it never shows.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 28 · F-28

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
The referral page renders two <h1> elements, so assistive technology has no single answer to what the page is.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Keep one <h1> naming the page and demote the second to <h2>. Worth aligning across routes while
you are there: the marketing root has one, /referral has two, and /pm has none.
```

**Anything else you would like to add?**
```
Reproduction. Open https://app.manic.trade/referral and run in the console:

  document.querySelectorAll("h1").length

Actual result: 2. Total headings on the page: 4.

For comparison, measured the same way in the same session:

  /              h1 = 1
  /leaderboard   h1 = 1
  /referral      h1 = 2
  /pm            h1 = 0

Three different answers on four routes of the same product.

Expected result. Exactly one <h1> per page.

Why it matters. The heading level tells a screen-reader user which line names the page. Two
top-level headings means the page announces itself twice with different words, and the
heading-jump shortcut lands somewhere ambiguous.

Related and filed separately: /pm and the event pages carry no heading elements at all.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 29 · F-29

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
About one in three markets whose slug carries a match date advertise a close date exactly seven days after that match.
```

**How often does this happen?** → **B. Sometimes**

> Answer "Sometimes" rather than "Every time": 15 of 45 sampled markets show the offset, and 28 are correct.

**How do you think this could be improved?**
```
Derive the close date from the event's own end time rather than from a default window. The
cluster sitting at exactly seven days, with nothing between one and seven, suggests a fallback
being applied when the real end time is missing.
```

**Anything else you would like to add?**
```
Reproduction. Take the event URLs in your sitemap whose slug ends in a date, and compare that
date against the "Ends" date in the same page's og:description.

  curl -sS https://app.manic.trade/pm/event/atp-wu-alcaraz-2026-09-04 | grep og:description

Actual result, across 45 markets sampled from the 83 that carry a date:

  offset (Ends date minus slug date)
     0 days : 28 markets     correct
     1 day  :  2 markets
     7 days : 15 markets     wrong

Fifteen of forty-five. Examples, all matches played on 4 September:

  atp-wu-alcaraz-2026-09-04         match 2026-09-04  ->  Ends Sep 11
  itf-ki-chentin-2026-09-04         match 2026-09-04  ->  Ends Sep 11
  wta-paolini-cirstea-2026-09-04    match 2026-09-04  ->  Ends Sep 11

The settled market I reported separately fits the same shape: played 2 September, advertising
settlement on 9 September. Four for four on the +7 pattern.

Expected result. A close date that matches when the market actually closes.

Stated carefully. I cannot see your settlement logic, so this is a measured distribution rather
than a diagnosis. What makes it look like a default rather than noise is that the wrong values
sit at exactly seven days with nothing in between, while 62% of the population is correct.

Why it matters. The close date is what a trader reads to decide whether a position can still
move and when funds are released.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 30 · F-30

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
The August promotion is still being advertised in September on the landing page, the leaderboard and the referral page.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Derive the label from the active reward period rather than writing the month in, so it rolls
over on its own.
```

**Anything else you would like to add?**
```
Reproduction. Open https://app.manic.trade/, /leaderboard and /referral on any date in
September and search the rendered text for "August".

Actual result. The string "August" appears in the rendered text of all three routes, checked on
4 September 2026 with the browser clock read in the same run. /pm and the event pages are clean.

Expected result. A promotional period that has ended stops being advertised.

Why it matters. A live trading venue advertising last month's reward programme reads as
unmaintained, and a user cannot tell whether the rewards they are looking at still apply to
them.

Related and filed separately: the same stale month appears in the navigation as "August
Rewards". I am filing this one because the reach is wider than the nav.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 31 · F-31

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
Four visible buttons on the landing page have no accessible name, so a screen reader announces them only as "button".
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Give each icon-only control an aria-label describing what it does, and label the unlabelled
input. Neither change is visible to sighted users.
```

**Anything else you would like to add?**
```
Reproduction. Open https://app.manic.trade/ and run in the console:

  [...document.querySelectorAll("button,a")].filter(e => {
    const label = (e.innerText||"").trim() || e.getAttribute("aria-label")
      || e.getAttribute("title") || e.querySelector("img[alt]")?.alt;
    const r = e.getBoundingClientRect();
    return !label && r.width > 0 && r.height > 0;
  }).length

Actual result: 4. All four are visible, sized and focusable, with no text, no aria-label, no
title and no labelled image inside them. Sampled by class: one styled
"hover:bg-fill-secondary", three styled "flex".

One <input> on the same page also has no label, no aria-label and no placeholder.

Measured the same way in the same session, /leaderboard and /referral returned 0, so this is
specific to the landing page rather than systemic.

Expected result. Every control carries a name.

Why it matters. A screen-reader user tabbing the landing page hears "button, button, button,
button" with nothing to distinguish them, and has to activate one to find out what it does.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---
---

## Screenshot uploads for this batch

| Submission | What to attach |
|---|---|
| 25 · F-25 | `F-25-unfurl.png` — the byte-cap table showing no title below 512 KB |
| 26 · F-26 | `F-26-completed.png` — the contradictory og:description |
| 27 · F-27 | `F-27-api-volume.png` — 17.4 MB, 8,610 events, 24 cards |
| 28 · F-28 | `F-28-headings.png` — the h1 count per route |
| 29 · F-29 | `F-29-date-offset.png` — the offset distribution and the 15 markets |
| 30 · F-30 | `F-30-august.png` — "August" present on three routes in September |
| 31 · F-31 | `F-31-unnamed.png` — the count of unnamed controls per route |

All seven are published at https://huntstamp-findings.vercel.app/forms.html, sitting in the
upload slot of their own submission block, with the raw capture each was rendered from
published beside it under `evidence/raw/`.
