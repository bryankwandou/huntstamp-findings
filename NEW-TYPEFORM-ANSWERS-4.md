# Typeform — fifth batch, the money-path finding

Same form: https://form.typeform.com/to/TzfbvaPZ

One submission, number 42. This is the finding closest to the programme's P0 weight,
and the one place the report stops at the edge of what a logged-out test can prove.

## The answers

**What device and browser were you using?**
```
Desktop PC / Windows 11 build 26200 / Node.js https client against the public events API / no wallet connected (logged-out guest session)
```

**When did it happen?**
```
September 5, 2026, 02:00-02:45, UTC
```

**Consent questions** → **A. I accept** on both.

---
---

# 42 · F-42

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
On matches the API itself marks finished (score.period FT), the order book stays open and still publishes an executable ask on outcomes that are now impossible, so funds can be sent to buy a token guaranteed to be worthless.
```

**How often does this happen?** → **A. Every time**

> "Every time" for the finished markets I checked: all 12 FT markets in the snapshot were still acceptingOrders, and the impossible-outcome asks persisted across repeated fetches.

**How do you think this could be improved?**
```
Close the book the instant a market reaches a final result. Gate acceptingOrders at both the
event and outcome level on the same FT signal that sets the final score, and cancel or freeze
resting orders on resolution so no new order can be matched against a decided outcome.
```

**Anything else you would like to add?**
```
This is the finding closest to your P0 weight, so I am stating exactly what I proved and
exactly what I did not.

WHAT I PROVED, read-only, no orders, no funds.
The public events API keeps publishing executable quotes on matches that are over.

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=sports&sort=trending&limit=500&offset=0&lite=true"

Filtering to events where score.period == "FT" (full time - the match has finished):

  finished (FT) markets in the snapshot      : 12
  of those still acceptingOrders = true      : 12  (every one)
  asks quoted on a finished outcome          : 8
  losing / impossible outcome still buyable  : 8
  resting bids on a finished outcome         : 14

Worked example, verified live at capture time - slug atc-alt-sb-2026-09-04:

  score  : 7-0   period FT   (Altach beat Bischofshofen 7-0)
  closed : false            event acceptingOrders : true
  "Draw"                          chance 0.0005   bestAsk 0.001   acceptingOrders true
  exact score "0 - 0"             chance 0.0025   bestAsk 0.005   acceptingOrders true
  "Bischofshofen first to score"  chance 0.005    bestAsk 0.01    acceptingOrders true

A 7-0 final makes a draw, a 0-0, and the loser scoring first all impossible - yet each still
carries an executable buy price. Other finished matches in the same snapshot behaved the same:
atp-butvila-potenza-2026-09-04 (6-4, 5-7, 6-7) and atc-ksv-fhw-2026-09-04 (0-1) both kept a
buyable losing outcome.

WHAT I DID NOT PROVE, and why.
I did not place an order, so I have not confirmed that one of these asks actually fills. This
session was logged out with no funds, and placing a real order is the one step I am not doing.
The confirming test needs a funded account:

  1. Fund a test account with the minimum USDC.
  2. Open a market the API reports as FT, e.g. the "Draw" outcome on a match that ended
     decisively.
  3. Place the smallest possible buy order against the quoted ask.
  4. Observe whether it fills, and whether the position later settles to zero.

If step 3 fills, real funds bought a worthless token on a decided market, and this is P0. If it
is rejected at submit despite the open quote, the defect is narrower - the venue advertises a
tradeable price it will not honour - but it is still wrong. Either way the fix is the same:
stop quoting decided markets.

Supporting data: decided-book.json and decided-book-ft.json in the evidence folder, and the
raw JSON for the 7-0 market at evidence/F-42-ft-market.json.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce (API origin bo-server-api.manic.trade)
```

---
---

## Screenshot upload for this batch

| Submission | What to attach |
|---|---|
| 42 · F-42 | `F-42-decided-book.png` — the FT-market counts and the 7-0 worked example |

Published at https://huntstamp-findings.vercel.app/forms.html in submission block 42, with the
raw capture and the market JSON beside it.
