# Draft — status letter to the CTO

Short version first, then a longer one. Pick whichever fits how your CTO reads.
Both are written to be forwarded without editing.

---

## Version A — short (email body, ~200 words)

**Subject:** Manic Polymarket bug bounty — 17 findings, 1 P1, report live

Hi [Name],

The Polymarket integration assessment is done for this round. Seventeen findings, filed
individually through Manic's Typeform.

Report: https://huntstamp-findings.vercel.app
Source: https://github.com/bryankwandou/huntstamp-findings

The one I would look at first is P1. On a market that has already settled, the outcome
block reads 100% / 0% while the chart legend directly beneath it reads 9% / 92% — a pair
that sums to 101% and contradicts a settlement the same screen just declared. A trader
reading the legend sees a live-looking market quoting an outcome at 92c that is already
worth a dollar.

Two P2s worth your time: the `/pm` entry URL stops resolving to the market directory once
any event has been opened, and I traced it to a localStorage key that overwrites the
navigation. And the route takes 94 to 136 seconds to finish loading, against 1.3 seconds
for polymarket.com on the same connection minutes apart.

Two things you should know before you read it. Everything was reached from a logged-out
guest session, so deposits, orders, positions, balances and P&L — where the P0 weight sits
— are untested. And the testing was AI-driven browser automation, not manual QA. Every
finding carries reproduction steps your team can run independently.

[Your name]

---

## Version B — full (for a written status report or a review meeting)

**Subject:** Manic Polymarket integration — assessment results and what remains

Hi [Name],

Here is where the Polymarket integration assessment stands.

**Result**

Seventeen findings, filed individually through the official Typeform: one P1, five P2,
eleven P3. The full report is published at https://huntstamp-findings.vercel.app with the
source at https://github.com/bryankwandou/huntstamp-findings. Each finding carries
reproduction steps, captured DOM text or measured numbers, and a proposed severity.

**The three that matter**

A settled market renders two contradictory price sets at the same time. The outcome block
shows the settlement values, 100% and 0%. The price chart legend directly underneath shows
9% and 92% — a pair that cannot exist, since complementary outcomes sum to 100, and one
that contradicts a settlement the same screen declared two lines earlier. On a market that
had not yet settled, the same defect would present a false arbitrage. I have proposed P1.

The `/pm` entry point — the URL named in Manic's own bounty brief — stops resolving to the
market directory once a user has opened any event. The cause is a localStorage key,
`pm-events-store`, which restores the previously opened event and rewrites the address bar.
Removing the key and reloading restores the directory, so this is a traced root cause
rather than an observed symptom. Anyone following a link to `/pm` from the docs, the blog
or the bounty brief itself lands somewhere else.

The route takes between 94 and 136 seconds to reach its load event, measured across two
cold loads, with time to first byte at 55 milliseconds. A control load of polymarket.com
on the same machine and connection minutes later completed in 1.3 seconds. The route
requests 113 separate JavaScript chunks, roughly a hundred of which report about 84 seconds
of wall time and resolve together — connection-pool saturation rather than any single slow
response.

**What I did not cover**

Deposits, real-money order placement, positions, balances, P&L and settlement crediting.
All of these require a funded account with USDC at risk, and none were exercised. That is
where this bounty's P0 weight sits, so the coverage above should be read as the display and
discovery layer only. If you want that ground covered, it needs a funded test account and
an explicit decision about who carries the risk on it.

**How the testing was done**

AI-driven browser automation against the live application — real page loads, real DOM
reads, real performance measurements — rather than manual QA. No account was created, no
wallet connected, no funds deposited, no orders placed. Every finding is written so your
team can reproduce it independently, which is the part that determines whether a report
survives triage.

**One thing I withdrew**

Mobile subcategory chips appeared non-functional: two taps selected the label text instead
of applying the filter. That would have been a reasonable P2. On re-testing, a programmatic
click on the same element applied the filter correctly, and the automation harness had been
timing out on synthetic clicks throughout that stretch. The evidence pointed at my test rig
rather than the application, so I pulled it rather than submit it. It is documented in the
report instead of deleted, because what was ruled out is part of the result.

**What I need**

Three fields on the Superteam submission cannot be completed without a Manic account: the
account identifier used for testing, the Polymarket deposit address, and a matching contact
email. Registering takes a few minutes and requires credentials I will not delegate. Tell
me whether you want that account opened under a company identity or a personal one, and
whether the P0 categories are in scope for this round.

[Your name]

---

## Notes on using these

**On the AI disclosure.** Both versions state it plainly rather than burying it. That is
the right call: the findings are strong enough to stand on reproduction steps, and a CTO who
discovers the method later reads it as concealment. Stated up front, it reads as method.

**On what is missing.** Both versions name the untested P0 categories in your own words
before anyone else can raise them. A status letter that only reports wins invites the
question you did not answer.

**What to change before sending.** Replace `[Name]` and `[Your name]`. If your CTO wants
severity in their own scheme rather than Manic's P0-P3, map it before sending. If the
company has a house format for status reports, use that skeleton and keep the content.
