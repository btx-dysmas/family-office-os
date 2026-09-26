# Family Office OS: Development Log

How the project was built, what went wrong, and what I learned. Organized by phase.

---

## Phase 1: Deciding what to build

After [Intrinsic](https://github.com/btx-dysmas/intrinsic-terminal) (equity research), I wanted a second project showing a different skill: wealth management. Instead of a third stock-analysis tool, I set out to build what a private banker would use to manage a wealthy family's entire financial life, using only free public data.

The key idea came early: **build the software around an Investment Policy Statement.** Student dashboards show numbers; institutions start from governance (objectives, risk limits, liquidity needs, spending policy and allocation ranges). If the IPS is data, the software can say when something is wrong, not just what it is.

## Phase 2: Proving the data was available

Before writing features, I tested every free source the design depended on:

- **Yahoo Finance fund data:** confirmed that expense ratios, sector weights, top holdings, and trailing and calendar-year returns are available for ETFs (VOO: 0.03%, 1.04% yield).
- **Long price histories:** Vanguard's index mutual funds (VFINX, VGTSX, VBMFX, VGSIX, VFISX) have daily prices back to 2000, so real dot-com and 2008 stress tests were possible. Gold futures start in August 2000.
- **SEC N-PORT:** found a path from ticker to complete holdings. `company_tickers_mf.json` maps VOO to series S000002839; EDGAR's browse endpoint accepts a series ID and returns an Atom feed of its NPORT-P filings. The first parse returned zero holdings because the filing index lists an XSL-rendered HTML copy before the raw XML, so the parser now skips the XSL path. SCHD parsed to 102 positions. Vanguard Total Bond Market's filing is enormous, so large filings needed a fallback.
- **Reference figures:** checked 2026 tax brackets, capital gains thresholds, contribution limits and the $15M estate exclusion against the IRS; bend points and the wage base against the SSA; tuition against the College Board. One head-of-household bracket I'd filled in from memory was $25 off; I corrected it.

## Phase 3: The data model and engines

I wrote the domain logic before any pages:

- **Data model:** households, people, entities with ownership links, accounts with tax treatment, real and private assets, liabilities, goals, life events, the IPS and relationship data.
- **Four demo households** at different levels of wealth: a $59M multi-generational family with trusts, LLCs, a foundation, art and an aircraft share; a tech couple with a concentrated NVDA position; a surgeon with a practice stake; and a young family saving for a first home.
- **Engines:** valuation, tax and Social Security, Monte Carlo, planning, IPS compliance, rebalancing, asset location, risk, stress tests, regime and committee, timeline and meeting brief.

**Early checks from the command line:** 10,000 simulations per household ran in about 60 ms. The Whitmores' legacy goal came out at only 31%, which revealed that the legacy test counted liquid investments but ignored the real estate, private holdings and dynasty trust that also pass to heirs. With those included it's 86%.

## Phase 4: Calibrating the demo

The first compliance run flagged seven breaches for most households, which made the dashboard noise rather than signal. A realistic book has mostly compliant families and a few real problems, so I rebalanced the seed portfolios and set return targets consistent with the capital market assumptions:

- **Whitmore:** compliant, with one real issue (the policy's stress-loss limit)
- **Chen–Alvarez:** the problem client, with NVDA at 37% of the portfolio, U.S. equities far over target and a stress loss beyond the limit
- **Raman:** one breach, excess cash
- **Okafor:** one watch item, a thin emergency fund (their down-payment savings sit outside the policy)

## Phase 5: The interface

Pages were built on a shared household layout: a dashboard, a book of business with an intake form, twelve household tabs, and market, research and reference pages.

**A styling bug:** layouts inside the household pages were collapsing into one column. The generated CSS was missing every class used only in files under `app/households/[id]/`: Tailwind's automatic source detection was skipping the dynamic-segment folder. Registering the folders explicitly with `@source` fixed it.

## Phase 6: Bugs found by reviewing every screen

I screenshotted every page with a headless browser and reviewed them one by one. Each of these looked plausible at a glance and was wrong:

| What I saw | Cause | Fix |
|---|---|---|
| Withdrawal-rate grid showing 100% everywhere | A goal counted as failed only if the shortfall exceeded **$1**, and the grid simulates a **$1** portfolio | Relative tolerance; 4% over 30 years now shows 70% at a moderate mix |
| Rebalancer leaving the 37% NVDA position untouched | Selling in tax-advantaged accounts first is right for drift but ignores concentration | Trim positions above the IPS limit first (about $192K of estimated tax, shown) |
| Rebalancer proposing to **buy NVDA** | "Buy the fund already held in this sleeve" matched the stock itself | Only diversified funds qualify as the buy vehicle |
| Proposed ETF purchases inside a savings account | Bank accounts were treated as brokerage accounts | Cash-only accounts are excluded from trading |
| Risk questionnaire scores above 100 | Seed answers outside the 0–3 scale | Fixed the seeds |
| A 64-year-old two years from retirement rated Aggressive on capacity | Capacity averaged factors equally | Capacity capped at Moderate within five years of retirement |
| "Heirs receive −$5.19M more" on the estate page | A default 10% charitable bequest costs heirs more than the tax it saves | Charity defaults to 0%, and the wording handles either direction |
| "−$0" and "−0.0%" in tables | Negative zero from rounding | Formatters normalize values that round to zero |
| "Eli Lilly &amp; Co" in fund holdings | XML entities in SEC filings | Decode entities when parsing |
| "$1756.88B" | No trillion unit | Added T |
| PDF section heading stranded at the bottom of a page | Page breaks only checked the heading's own height | Headings reserve room for the content that follows |

## Phase 7: PDF reports

The client review report and meeting brief are built with jsPDF in the browser. To check the output, I intercepted the generated file, rendered each page with pdf.js and reviewed it as an image: four pages with the allocation chart, fan chart, tables for goals, risk, stress, compliance and the economy, and disclosures. Chart images were reduced from 2× to 1.5× resolution, cutting the file from 4.3 MB to 2.5 MB.

## Phase 8: Cleanup and documentation

Removed sixteen unused generated UI components, the framework boilerplate and the default icons; wrote the README, [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS.md](DECISIONS.md) and this log.

---

## What I learned

- **Governance is a design tool.** Once the IPS was data, features like compliance, rebalancing, meeting prep and reports fell out of it instead of being built separately.
- **Plausible isn't correct.** Most of the bugs above produced reasonable-looking output. Reviewing every screen against what a professional would expect caught them.
- **Check the data before designing around it.** Confirming N-PORT, long price histories and fund data up front shaped the architecture and avoided building on sources that didn't exist.
- **Tax awareness changes the answer.** The "correct" rebalance and the tax-efficient one are different trades, and the difference can be six figures.
- **Demo data is part of the product.** A realistic book, with mostly healthy families and a few real problems, shows what the software does far better than random numbers.
