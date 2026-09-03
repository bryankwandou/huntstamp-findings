# Manic Bug Bounty — Polymarket Integration

Test session against `app.manic.trade/pm`, 3 September 2026.

Published report: https://claude.ai/code/artifact/f60b9b20-aa5d-44ab-977d-bef880b2aa85

## Contents

| File | What it holds |
|---|---|
| `FINDINGS.md` | All 17 findings in full, plus one finding withdrawn during the session and the reasoning behind withdrawing it |
| `SUBMISSIONS.md` | Copy-paste blocks for the official Typeform, one per finding, ordered by severity |
| `evidence/` | Screenshots go here before submitting — the exact frames to capture are listed at the end of `SUBMISSIONS.md` |

## Result

| Severity | Count | Headline |
|---|---|---|
| P1 | 1 | A settled market shows two contradictory price sets; one pair sums to 101% |
| P2 | 5 | `/pm` stops resolving to the directory, settlement date a week out, buy buttons live on an unpriced outcome, resolved market in Trending, 94–136 s page load |
| P3 | 11 | Filters, formatting, accessibility, stale promotional copy |
| Withdrawn | 1 | Evidence pointed at the test harness rather than the app |

## Environment

| Field | Value |
|---|---|
| Build | Vercel deployment `dpl_74W5o38E8FQjJUZ2DYo5PFDHEsLs` |
| Browser | Chromium 148.0.7778.280 |
| OS | Windows 11, build 26200 |
| Viewports | 1280×720 desktop, 375×812 mobile |
| Session | Logged-out guest, no wallet connected |

## Not covered

Deposits, real-money order placement, positions, balances, P&L, and settlement crediting.
All of these need a funded account and were not exercised. That is where this bounty's P0
weight sits, so the coverage here should be read as the display and discovery layer only.

## Session constraints

Every finding was reached as a logged-out guest. No wallet was connected, no funds were
deposited, no orders were placed, and no form was submitted on anyone's behalf.
