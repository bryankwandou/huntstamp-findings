# Typeform — sixth batch

Same form: https://form.typeform.com/to/TzfbvaPZ

One submission, number 43, from a paging and pricing pass over the public events API
on 5 September. The pricing half of that pass found nothing wrong, which is recorded
inside the finding rather than dropped.

## The answers

**What device and browser were you using?**
```
Desktop PC / Windows 11 build 26200 / Node.js https client against the public events API / no wallet connected (logged-out guest session)
```

**When did it happen?**
```
September 5, 2026, 03:00-03:30, UTC
```

**Consent questions** → **A. I accept** on both.

---
---

# 43 · F-43

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
The events API's paging metadata contradicts itself: it reports a total of 384 while serving 376, says hasMore is false when more rows exist at a higher offset, and leaves eight events reachable by no offset at all.
```

**How often does this happen?** → **A. Every time**

> Reproduced on every request to this tag during the capture window. Two other tags showed a smaller version of the same mismatch earlier in the session but were self-consistent when I re-checked, so I am filing only the one that reproduces.

**How do you think this could be improved?**
```
Derive total, count and hasMore from the same query that produces the rows, inside one
transaction, so the three cannot disagree. hasMore should be true whenever a higher offset
would return anything, and offset should be a stable cursor into an ordered set rather than
repeating rows once it passes the served window.
```

**Anything else you would like to add?**
```
Reproduction. Walk the offsets on one tag and read only the paging fields the API returns
about itself:

  curl -sS "https://bo-server-api.manic.trade/charts/pm/events?tag=weather&sort=trending&limit=500&offset=0&lite=true"

Actual result:

  offset=0     total=384   count=376   hasMore=false   events[] served=376
  offset=376   total=384   count=4     hasMore=false   events[] served=4
  offset=384   total=384   count=0     hasMore=false   events[] served=0
  offset=500   total=384   count=0     hasMore=false   events[] served=0
  limit=100 offset=300  ->  total=384  count=76  hasMore=false  served=76

Union of distinct event ids across offsets 0, 100, 200, 300, 376, 384 and 400:

  API-reported total                        : 384
  distinct events actually reachable        : 376
  events counted but reachable by no offset :   8

Three contradictions, all inside the same responses:

  1. hasMore is false at offset=0, yet offset=376 returns four more rows. A client that
     trusts hasMore stops paging and never asks for them.
  2. total says 384 while only 376 distinct events can be retrieved by any combination of
     offset and limit. Eight events are counted and never served.
  3. The four rows at offset=376 are events already in the first page, so offset repeats
     rows rather than advancing once it passes the served window.

Expected result. total, count and hasMore agree with each other and with the rows, and every
counted event is reachable.

Why it matters. Any client that pages this endpoint - yours included - either stops early and
silently hides markets, or loops re-reading rows it already has. Eight markets in this tag
cannot be reached at all, and a market a user cannot reach is a market they cannot trade.

None of these figures come from comparing two separate requests, so none of them is a race:
each contradiction is between fields in one response.

Checked and sound in the same pass, stated so the coverage is clear. The volume sort was
correctly monotone on all fourteen tags, and every multi-outcome price group summed within
tolerance of 1 - no negRisk group and no other outcome group was mispriced. I went looking for
a pricing bug here and did not find one.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce (API origin bo-server-api.manic.trade)
```

---
---

## Screenshot upload for this batch

| Submission | What to attach |
|---|---|
| 43 · F-43 | `F-43-pagination.png` — the offset walk and the unreachable-event count |
