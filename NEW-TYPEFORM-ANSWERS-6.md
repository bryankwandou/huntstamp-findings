# Typeform — seventh batch

Same form: https://form.typeform.com/to/TzfbvaPZ

Two submissions, 44 and 45, from a pass that reached the pages beyond the market
directory and the order-book endpoint behind the cards, on 5 September.

## The answers identical on both

**What device and browser were you using?**
```
Desktop PC / Windows 11 build 26200 / headless Chromium via Playwright against the live site and public API / no wallet connected (logged-out guest session)
```

**When did it happen?**
```
September 5, 2026, 05:00-06:00, UTC
```

**Consent questions** → **A. I accept** on both.

---
---

# 44 · F-44

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
The site's own sitemap.xml lists market URLs that no longer exist in the events API, and each one is served as an HTTP 200 of the 1.5 MB application shell, indistinguishable from a live market.
```

**How often does this happen?** → **B. Sometimes**

> Four of the 473 event URLs in the sitemap at capture time. A small share, but each is a dead link the site is actively advertising to search engines.

**How do you think this could be improved?**
```
Generate the sitemap from the same source of truth as the events API so a market that has left
the catalogue leaves the sitemap, and return a real 404 for an event slug the API no longer
knows, rather than the 200 shell.
```

**Anything else you would like to add?**
```
Reproduction.

  curl -s https://app.manic.trade/sitemap.xml | grep -o "/pm/event/[^<]*"

gives 473 event URLs. Cross-checking each slug against the events API, four are no longer
present in it:

  how-many-fed-rate-hikes-in-2026-20260623190717369
  iran-full-airspace-closure-byptptpt-20260625195253028
  lol-lck-2026-season-winner
  pro-football-2026-mvp-winner

Requesting each live:

  GET /pm/event/how-many-fed-rate-hikes-in-2026-20260623190717369  ->  HTTP 200  1,536,386 bytes
  GET /pm/event/pro-football-2026-mvp-winner                       ->  HTTP 200  1,536,075 bytes

A live market for contrast returns the same 200 and ~1.5 MB, so nothing tells a dead sitemap
entry apart from a working one.

Expected result. The sitemap lists only markets that still exist, and a slug the API no longer
knows returns 404.

Why it matters. This is distinct from the invented-slug finding, where the URL was made up.
Here the site's own sitemap - the file it hands to Google - is the source of the dead links, so
search engines are led to index markets that are gone, and a user arriving from search lands on
the shell with no market.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 45 · F-45

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
The ask price shown on a directory card disagrees with the real order book behind it - by up to 12 cents on a one-dollar contract - so the price a user reads is not the price the book would fill at.
```

**How often does this happen?** → **B. Sometimes**

> 16 of 120 outcomes cross-checked, about 13%, with most gaps 1-3 cents and a worst case of 12. Filing as "Sometimes" rather than "Every time".

**How do you think this could be improved?**
```
Serve the directory card's price from the same book snapshot the trade screen uses, or refresh
the listing's cached price often enough that the gap cannot open. Whichever value is canonical,
the card and the book should not show two different asks for the same outcome at the same moment.
```

**Anything else you would like to add?**
```
Reproduction. For each outcome in the events API that carries a bestAsk, read the real order
book and compare:

  curl -s "https://bo-server-api.manic.trade/charts/pm/events?tag=sports&sort=trending&limit=500&offset=0&lite=true"
  curl -s "https://bo-server-api.manic.trade/charts/pm/book?token=<tokenIdYes>"

Across 120 outcomes, 16 had a directory ask disagreeing with the book's best ask by more than a
cent:

  dota2-nem-carst-2026-09-05  Game 2 Winner   directory 0.780   real book best ask 0.900   +12c
  dota2-nem-carst-2026-09-05  Game 1 Winner   directory 0.810   real book best ask 0.860   +5c
  lol-ig1-tes-2026-09-05      Total Kills O/U 27.5 G3   directory 0.920   book 0.950   +3c
  atp-samrej-tseng-2026-09-05 Samrej vs Tseng directory 0.570   real book best ask 0.540   -3c

Expected result. The price on the card matches the order book it trades against.

Why it matters. The book endpoint returns a real, deep book - the sampled markets carried tens
of resting orders a side, so this is not an empty-book artefact. A user who picks a market
because the card reads 0.78 meets a real best ask of 0.90 on the trade screen: a 12-cent
surprise on a one-dollar contract, on the price that most drives the decision to click.

Checked and sound, stated for coverage: of 60 live markets sampled, every one had a real order
book - none empty - so the book service itself is healthy. The gap is between the listing's
cached price and the live book.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---
---

## Screenshot uploads for this batch

| Submission | What to attach |
|---|---|
| 44 · F-44 | `F-44-live.jpg` |
| 45 · F-45 | `F-45-live.jpg` |
