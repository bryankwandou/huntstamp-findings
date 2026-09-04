# Typeform — second batch, seven more submissions, written out in full

Same form: https://form.typeform.com/to/TzfbvaPZ

These are findings 18 to 24, from the sweep on 4 September. Every field is filled. Copy the
block, paste it, move to the next. Numbering continues from the first batch, so these are
submissions 18 through 24.

## The answers identical on all seven

**What device and browser were you using?**
```
Desktop PC / Windows 11 build 26200 / headless Chromium via Playwright / no wallet connected (logged-out guest session)
```

**When did it happen?**
```
September 4, 2026, 03:40-04:00, UTC
```

**Consent questions** → **A. I accept** on both, same reasoning as the first batch: nothing
secret was included, nothing was exploited repeatedly or disclosed publicly, the testing was
AI-driven automation rather than manual QA, and every finding carries steps Manic's own team
can run.

---
---

# 18 · F-18

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
The trading interface renders inside a cross-origin iframe, because neither X-Frame-Options nor a CSP frame-ancestors directive is sent.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Send Content-Security-Policy: frame-ancestors 'none' on every application route, and
X-Frame-Options: DENY alongside it for older clients. If any surface is meant to be
embeddable, allow that origin explicitly rather than leaving the whole application framable.
```

**Anything else you would like to add?**
```
Reproduction. Serve this page from any origin that is not manic.trade, and open it:

  <iframe src="https://app.manic.trade/pm" width="1200" height="700"></iframe>

Actual result. The frame attaches, loads and paints the live application. Text read back
from inside the frame, verbatim:

  Skip to content Trade Referral Leaderboard August Rewards Log In Manic Trade
  Polymarket Trade All Crypto Sports Politics Economy Tech Culture Weather Trending
  Liquidity Volume Newest Ending Soon Competitive Hantavirus pandemic in 2026?
  Yes 3% No 97% $18.0M Vol New pandemic in 2026? Yes 6% No 94% $1.

That is the market grid, live prices, the sort controls and the Log In button, rendering
under a third-party domain. The browser raised no framing objection: a collector watching
for framing and CSP messages caught none.

Confirmed at the header level too. Neither header is present on the /pm response:

  curl -sSD - -o /dev/null https://app.manic.trade/pm

  Content-Security-Policy   absent
  X-Frame-Options           absent

Expected result. X-Frame-Options: DENY, or CSP frame-ancestors 'none'.

Why it matters. On a venue where a click places an order, a framable interface is the setup
for clickjacking: an attacker overlays their own page on the frame and the victim's click
lands on a control they cannot see. The Log In button being reachable inside the frame is
the part worth looking at first.

Stated plainly: I demonstrated that the page frames. I did not build a working clickjacking
exploit and did not attempt one, since that needs an interactive control and a funded
session, both outside a logged-out read-only test. This is a missing control with the
framing proven, not a proven end-to-end attack.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 19 · F-19

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
No security response headers are sent at all, and the one cookie set on the route carries neither Secure nor HttpOnly.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Add X-Content-Type-Options: nosniff and a Referrer-Policy first, since both are one line
each and carry no behavioural risk. A Permissions-Policy and a Content-Security-Policy are
the larger pieces of work. Set Secure on the is-mobile cookie while you are in there.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sSD - -o /dev/null https://app.manic.trade/pm

Actual result. All of these are absent from the response:

  Content-Security-Policy       absent
  X-Frame-Options               absent
  X-Content-Type-Options        absent
  Referrer-Policy               absent
  Permissions-Policy            absent
  Cross-Origin-Opener-Policy    absent

What is sent, and is correct: Strict-Transport-Security: max-age=63072000, and http://
redirects to https:// with a 308.

The one cookie on this route:

  Set-Cookie: is-mobile=0; Path=/; Expires=...; Max-Age=86400; SameSite=lax

with no Secure and no HttpOnly attribute.

Honest scoping, so you can triage this correctly. is-mobile is a viewport hint rather than a
session token, and HSTS plus the 308 makes the missing Secure flag largely theoretical on
this host. nosniff and a Referrer-Policy are the two worth adding regardless. The framing
directive is filed separately, and that is where the real weight sits.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 20 · F-20

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
A market slug that does not exist returns HTTP 200 with the landing-page title instead of a 404, and the browser is then silently redirected to the directory.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Return 404 when a market slug does not resolve, and render a page that says the market was
not found with a link back to the directory. The neighbouring routes already do this
correctly, so the fix is to make the event route behave like them.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sS -o /dev/null -w "%{http_code} %{size_download}\n" \
    https://app.manic.trade/pm/event/this-market-does-not-exist-2099

Actual result. Three invented slugs, all served as successful pages:

  200  1,535,682 bytes   /pm/event/this-market-does-not-exist-2099
  200  1,535,625 bytes   /pm/event/aaaaaaaaaaaa
  200  1,535,661 bytes   /pm/event/atp-fake-fake-2099-12-31

The response carries the generic landing-page title rather than a market or an error:

  <title>Manic.Trade: the First Momentum-based Trading Platform on Solana</title>

with no rel="canonical". In the browser the address is then rewritten to /pm and the market
directory renders, with nothing said about the market that was requested.

The routing is inconsistent, which is what makes this a defect rather than a decision:

  /pm/nonsense-subroute        404   correct
  /pm/event/                   404   correct
  /pm/event/anything-at-all    200   wrong

Expected result. 404 for a slug that does not resolve, or a page saying the market was not
found.

Why it matters. Three separate costs. A user following an old or mistyped market link is
dumped on the directory with no explanation of where their market went. Search engines are
invited to index an unbounded space of invalid URLs as valid pages. And uptime monitoring
cannot distinguish a working market link from a broken one, because both return 200.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 21 · F-21

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
Route matching is case-sensitive, so /PM returns a 404 while /pm works.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Lower-case the path before matching, or add a redirect from the capitalised form. Either is
a small change and both remove the failure.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sS -o /dev/null -w "%{http_code}\n" https://app.manic.trade/pm    ->  200
  curl -sS -o /dev/null -w "%{http_code}\n" https://app.manic.trade/PM    ->  404

Actual result. /PM renders "404 This page could not be found."

Expected result. Both forms reach the market directory.

Why it matters. A link capitalised by an email client, a CMS, a print asset or a person
typing it out lands on an error page rather than the product.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 22 · F-22

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
There is not one heading element on any page, and each page carries two <main> landmarks, so screen-reader users have no document outline to navigate by.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Give each page one <h1> naming it — the market title on an event page, the category on the
directory — with section headings below it in order. Reduce to a single <main> and put the
navigation in a <nav>. The market cards are already styled as headings visually; this is a
markup change, not a design change.
```

**Anything else you would like to add?**
```
Reproduction, counted in the HTML the server returns:

  curl -sS https://app.manic.trade/pm | grep -o "<h1[ >]" | wc -l

Actual result:

                  /pm    event page
  <h1>             0         0
  <h2>             0         0
  <h3>             0         0
  <main>           2         2
  <nav>            0         0

Confirmed a second way in the live DOM after hydration: document.querySelectorAll("h1")
returns 0, and querying h1,h2,h3,h4 together returns an empty list.

Expected result. One <h1> per page, section headings in order below it, exactly one <main>.

Why it matters. The heading-jump shortcut is the primary way many screen-reader users move
through a page, and here it does nothing at all — there is nothing to jump to. Two <main>
elements is also invalid: the spec allows at most one visible main per document, so
assistive technology cannot tell which one holds the content.

Related, already filed separately: 21 of 23 images on the directory carry no alt attribute.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 23 · F-23

**What are you submitting?** → **A. A bug**

**Briefly describe the problem in one sentence.**
```
The link preview for a settled market advertises it as still open, telling anyone it is shared with that the market ends on 9 September.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Build the preview description from the market's current state. A settled market should say
it settled and give the result, rather than a close date that has passed.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sS https://app.manic.trade/pm/event/atp-faria-alcaraz-2026-09-02 | grep og:description

Actual result. Served to every link unfurler:

  <meta property="og:title"       content="US Open ATP: Jaime Faria vs Carlos Alcaraz">
  <meta property="og:description" content="$4K traded · Ends Sep 9">
  <meta name="description"        content="$4K traded · Ends Sep 9">

The match was played on 2 September, which the event slug itself records. The page shows a
final score of 2-6, marks the market Resolved, and closes the order book. Paste that URL
into Slack, X, Discord or Telegram and the card still says the market ends 9 September.

Expected result. A preview that reflects the settled state.

Why it matters. This is the same incorrect date reported separately against the Settlement
Time field, but on a surface with a wider audience: the preview is what people see before
they click, and it is what gets forwarded. A shared link is currently an advertisement for a
market nobody can trade.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---

# 24 · F-24

**What are you submitting?** → **C. A bug with a suggested improvement**

**Briefly describe the problem in one sentence.**
```
Every 404 response carries the full application HTML, so a missing page costs 1.44 MB to render five words of error text.
```

**How often does this happen?** → **A. Every time**

**How do you think this could be improved?**
```
Serve a small static not-found page rather than the full application shell. While you are
there, publishing /.well-known/security.txt would tell researchers where to report, which
is worth doing for a platform running a public bounty.
```

**Anything else you would like to add?**
```
Reproduction:

  curl -sS -o /dev/null -w "%{http_code} %{size_download}\n" \
    https://app.manic.trade/this-does-not-exist

Actual result:

  404  1,512,170 bytes   /this-does-not-exist
  404  1,512,170 bytes   /.well-known/security.txt

Expected result. A not-found response measured in kilobytes.

Why it matters. Every crawler hitting a dead link, every mistyped URL and every stale
bookmark costs a megabyte and a half of egress. It is not urgent, but it is free to fix.

Also noted: /.well-known/security.txt is absent. For a platform running a public bug bounty
that file is small housekeeping — it tells researchers where to send reports.

Build: dpl_C3bXHquKbKr1sjn9WpRtDt8MWfce
```

---
---

## Screenshot uploads for this batch

Most of this batch is server behaviour rather than something on screen, so the natural
evidence is terminal output rather than a page.

| Submission | What to capture |
|---|---|
| 18 · F-18 | `evidence/F-18-framed.png` — already captured, the app rendering inside the frame |
| 19 · F-19 | Terminal showing `curl -sSD - -o /dev/null https://app.manic.trade/pm` |
| 20 · F-20 | Terminal showing the three 200 responses for invented slugs |
| 21 · F-21 | Terminal showing 200 for `/pm` and 404 for `/PM` side by side |
| 22 · F-22 | Terminal showing the `<h1>` count of 0 and `<main>` count of 2 |
| 23 · F-23 | Terminal showing the `og:description` line, or the Slack unfurl of that URL |
| 24 · F-24 | Terminal showing the 404 status with the byte count |

For 23 the stronger capture is the actual unfurl: paste the market URL into a Slack DM to
yourself and screenshot the card. It shows the defect the way a user meets it.
