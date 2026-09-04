# Third sweep — seven further findings

Captured 4 September 2026 against deployment `dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce`.
Read-only throughout: logged out, no wallet, no funds, no orders.

This sweep went wide rather than deep. It sampled 60 event pages and 45 dated markets from
the sitemap, walked the routes outside `/pm`, and measured what the directory actually
downloads to draw its first screen.

Raw data: `mass-scan.json`, `date-offset.json`, `api-usage.json`, `surface-scan.json`,
`nav-check.json`, `find404.json`, `zero-check.json`.

One correction to the second sweep is recorded at the end.

---

## F-25 · Title and Open Graph tags sit beyond 256 KB, so most unfurlers see nothing · P2

Every event page emits its `<title>` and Open Graph metadata near the very end of a 1.5 MB
document, in several cases after `</head>` has already closed.

Measured across 60 sampled event pages:

| | |
|---|---|
| pages whose `<title>` sits beyond 256 KB | **60 of 60** |
| earliest `<title>` offset seen | 501,187 bytes |
| latest `<title>` offset seen | 1,534,261 bytes |
| pages where `<title>` appears after `</head>` | 13 of 60 |

On one page measured byte by byte: `<head>` opens at 55, `</head>` closes at 504,898, and
`<title>` appears at **1,533,738** — 99.9% of the way through the document, inside `<body>`.

**The consequence, measured rather than assumed.** Requesting the same page with a Slackbot
user agent and stopping after a fixed number of bytes:

```
  cap      title                        og:description
  64KB     (none)                       (none)
  128KB    (none)                       (none)
  256KB    (none)                       (none)
  512KB    US Open ATP: Jaime Faria v   Ends Sep 9
  1024KB   US Open ATP: Jaime Faria v   Ends Sep 9
```

Identical across three consecutive runs. Any unfurler or crawler that caps its fetch below
roughly 512 KB gets **no title and no description at all**, so a shared market link renders
as a bare URL or an empty card.

**Expected.** Title and Open Graph tags emitted inside `<head>`, in the first few kilobytes,
ahead of the application payload.

**Reproduce:**

```
curl -sS https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02 | head -c 262144 | grep -c "<title>"
```

Returns 0. Raise the cap to 524288 and it returns 1.

Evidence: `evidence/F-25-unfurl.png`, `evidence/raw/F-25-unfurl.txt`

---

## F-26 · One market advertises itself as completed, priced at 50%, and closing next week · P3

The Open Graph description served for `itf-danil-laro-2026-09-04`:

```
$44K traded · Completed Match 50% · Ends Sep 11
```

Three statements that cannot all hold at once. A completed match has an outcome, so it cannot
sit at 50%, and it cannot close a week after it finished.

**Frequency, stated honestly.** This appeared once, in a 60-page sample. A targeted re-scan of
45 dated markets found no second instance. It is filed as a single observation with the slug
recorded, not as a pattern.

**Expected.** A completed market shows its settled price and its settlement date.

**Reproduce:**

```
curl -sS https://app.manic.trade/pm/event/itf-danil-laro-2026-09-04 | grep og:description
```

---

## F-27 · The directory downloads 17.4 MB and 8,610 events to render 24 cards · P2

Observing only the network the page makes on its own, with no interaction:

| | |
|---|---|
| API calls | 58 |
| calls requesting `limit=500` | 22 |
| distinct category tags queried | 14 |
| total API bytes | **18,246,307** (17.4 MB) |
| event objects returned | **8,610** |
| market cards actually rendered | **24** |

The tags fetched: pandemics, science, business, geopolitics, economy, crypto, sports,
politics, elections, pop-culture, weather, world, tech, finance. The user is looking at
"Trending".

It also paginates each tag: `offset=0`, then `offset=500`, then `offset=1000`. The four
largest responses were 1.37 MB, 1.36 MB, 1.35 MB and 1.17 MB, each carrying 500 events.

That is 359 event objects downloaded for every card displayed.

**Expected.** Fetch the visible tab, at the page size actually rendered, and fetch the rest
when the user asks for it.

**Why it matters.** This is bandwidth on a mobile connection, memory in the tab, and load on
`bo-server-api.manic.trade`, multiplied by every visitor who opens the directory.

**How this relates to the withdrawn F-10.** I previously reported this route as slow and then
withdrew it, because the 94-second figure came from my instrumented browser rather than from
the application. This finding is what the evidence actually supports: the route is not slow to
load, but it does move 17.4 MB it never displays. The measurement is of response bodies, not
of wall-clock time, so it does not depend on my environment.

Evidence: `evidence/F-27-api-volume.png`, `evidence/raw/F-27-api-volume.txt`

---

## F-28 · The referral page carries two `<h1>` elements · P3 · accessibility

`/referral` renders two level-one headings. The top-level heading names the page once; two of
them leave assistive technology with no single answer to "what is this page".

Counted in the hydrated DOM: `h1 = 2`, total headings = 4.

For comparison, the marketing root has exactly one and `/pm` has none at all — three different
answers on three routes of the same product.

**Expected.** One `<h1>` per page.

---

## F-29 · A third of dated markets close exactly seven days after their match · P2

Taking the 83 event URLs whose slug carries a date, sampling 45, and comparing the date in the
slug against the "Ends" date in the market's own description:

```
offset (Ends date minus slug date)
   0 days : 28 markets     correct
   1 day  :  2 markets
   7 days : 15 markets     wrong
```

**15 of 45, one in three.** Examples, all matches played on 4 September:

```
atp-wu-alcaraz-2026-09-04         match 2026-09-04  ->  Ends Sep 11
itf-ki-chentin-2026-09-04         match 2026-09-04  ->  Ends Sep 11
wta-paolini-cirstea-2026-09-04    match 2026-09-04  ->  Ends Sep 11
```

The settled market reported separately as F-03 fits the same shape: played 2 September,
advertising settlement on 9 September. Four for four on the +7 pattern, in a population where
62% are correct.

**Stated carefully.** I cannot see the settlement logic, so this is a measured distribution
rather than a diagnosis. The cluster sitting at exactly seven days, with nothing between one
and seven, is what makes it look like a default rather than noise.

**Why it matters.** The close date is what a trader reads to decide whether a position can
still move and when funds are released. On a third of dated markets it is a week out.

Evidence: `evidence/F-29-date-offset.png`, `evidence/raw/F-29-date-offset.txt`

---

## F-30 · The August promotion is still running on every route in September · P3

Reported separately against the navigation as F-16. This sweep found it is not confined to the
nav: the string "August" appears in the rendered text of `/`, `/leaderboard` and `/referral`,
checked on 4 September with the browser clock read in the same run.

`/pm` and the event pages are clean.

**Expected.** A promotional period that has ended should stop being advertised, or the label
should be derived from the active period rather than written in.

---

## F-31 · Four controls on the landing page have no accessible name · P3 · accessibility

On `/`, four visible buttons expose no text, no `aria-label`, no `title` and no labelled image.
A screen reader announces them as "button" and nothing more. One `<input>` on the same page has
no label, no `aria-label` and no placeholder.

Sampled elements: one styled `hover:bg-fill-secondary`, three styled `flex`.

`/leaderboard` and `/referral` have none of this, so the pattern is specific to the landing page
rather than systemic.

**Expected.** Every control carries a name — visible text, or `aria-label` when it is an icon.

---

## Checked in this sweep and found sound

Recorded so the coverage is legible, and because two of these nearly went out as findings.

**Every navigation link resolves.** All four distinct visible links on `/pm` return 200. I had
expected a broken "Discover" entry after `/discover` returned 404, but Discover is a panel
trigger rather than a link — the URL was one I invented, and nothing on the site points at it.

**No failing requests anywhere.** Loading `/`, `/leaderboard`, `/referral` and `/pm` produced
zero responses at 400 or above.

**Metadata I expected to be missing is present.** Across 60 sampled event pages: `rel=canonical`
on 60, `og:image` on 60, `twitter:card` on 60, meta description on 60, and no two pages sharing
a title. An earlier broken scan reported all of these as absent; that scan was truncating
response bodies at 400 KB, which is also how F-25 came to light.

**Resource timing zeroes are a browser privacy behaviour, not failures.** 99 of 178 resources
reported zero transferred and zero decoded bytes. All were cross-origin — PostHog, Turnkey,
Google Tag Manager and `bo-server-api.manic.trade` — which report zero without a
`Timing-Allow-Origin` header. Every one returned 200 or 204.

---

## Correction to the second sweep

**F-20 overstated one detail.** I wrote that the soft-404 response carries no `rel="canonical"`.
The wider scan shows canonical present on all 60 sampled event pages. The claim held for the
invented-slug response I inspected, but I generalised it further than the evidence supported.
The finding itself is unaffected: an invented slug still returns HTTP 200 with the generic
landing-page title where neighbouring routes correctly return 404.

---

## Still untested, and still where the weight is

Deposits, order placement, order matching, positions, balances, withdrawals and settlement
crediting all require a funded account with real USDC at risk. None of it has been touched in
any of the three sweeps.
