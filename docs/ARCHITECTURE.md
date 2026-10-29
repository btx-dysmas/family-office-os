# Family Office OS: Architecture

How the platform is built: the data model, where each engine runs, how the investment policy drives the rest of the system, and how public data flows in. For *why* each choice was made, see [DECISIONS.md](DECISIONS.md); for the history, see [DEVLOG.md](DEVLOG.md).

---

## 1. Goals and constraints

1. **The whole household, not just the portfolio.** Entities, accounts, real and private assets, debts, goals, people and relationships in one model.
2. **Governance first.** A written investment policy statement (IPS) is the source of truth that compliance, rebalancing, risk, reports and meeting prep all read from.
3. **Explainable.** Every number comes from a public source, a stated assumption or a documented formula. No language model.
4. **Interactive.** Plans, stress tests and rebalancing recalculate as the advisor types.
5. **Zero cost.** Vercel's free tier and GitHub, public data only, no database.

## 2. System overview

```
┌────────────────────────────────── Browser ──────────────────────────────────┐
│  Household book (lib/store.ts): useSyncExternalStore + localStorage          │
│                                                                              │
│  Household model (per page, memoized)                                        │
│    value()       live valuation, balance sheet, ratios, estate inclusion     │
│    buildPlan()   cash flows, goals, life events → simulate() Monte Carlo     │
│                                                                              │
│  Engines                                                                     │
│    ips.ts        compliance · rebalancing · asset location · harvesting      │
│    planning.ts   retirement gap · education · affordability · estate         │
│    risk.ts       questionnaire · capacity · heat map                         │
│    stress.ts     historical replay · hypothetical shocks                     │
│    regime.ts     regime rules · investment committee                         │
│    brief.ts      meeting prep       timeline.ts  household milestones        │
│    analytics.ts  historical performance and risk contribution                │
│    pdf.ts        client review and meeting brief (jsPDF)                     │
└───────────────────────────────────────▲──────────────────────────────────────┘
                                        │ JSON (cached per URL for the session)
┌───────────────────────────────────────┴───────────── Vercel ────────────────┐
│  CDN cache: s-maxage + stale-while-revalidate                                │
│  Route handlers (serverless)                                                 │
│    /api/quotes    last price and previous close (≤ 80 symbols)               │
│    /api/prices    adjusted daily closes on the S&P 500 calendar (≤ 40)       │
│    /api/fund      expense ratio, sectors, top holdings, returns              │
│    /api/nport     complete holdings from the latest SEC Form N-PORT           │
│    /api/macro     FRED series, Treasury curve, S&P 500 valuation and trend   │
│    /api/stress    asset-class returns through four historical crises         │
│  lib/server: Yahoo (cookie + crumb), FRED, Treasury CSV, SEC (rate-limited)  │
└───────────────────────────────────────▲──────────────────────────────────────┘
                                        │
             Yahoo Finance · FRED · U.S. Treasury · SEC EDGAR (N-PORT)

Reference data compiled into the app (lib/reference.ts):
  IRS 2026 brackets, capital gains thresholds, NIIT, contribution limits, estate and gift exclusions
  SSA 2026 bend points and wage base · College Board 2025–26 tuition
```

The server only fetches and caches public data. Every household-specific calculation runs in the browser, where the household lives.

## 3. Data model

Defined in `lib/types.ts`. A `Household` contains:

| Part | Contents |
|---|---|
| **People** | Clients, spouse, children, grandchildren and others, with dates of birth, income, retirement age, planning age and Social Security claiming age |
| **Entities** | Individual, joint, revocable trust, irrevocable trust, LLC, foundation, donor-advised fund, custodial and 529, with a parent link so ownership forms a tree |
| **Accounts** | Owner entity, custodian, tax treatment (taxable, tax-deferred, tax-free, tax-exempt), whether the IPS governs it, and holdings (symbol, shares, cost basis) |
| **Other assets** | Residences, investment real estate, private equity, venture, businesses, art and aircraft, each owned by an entity with a valuation date and optional income |
| **Liabilities** | Balance, rate and payment, owned by an entity |
| **Goals** | Retirement, education, home, purchase and legacy, with year, amount in today's dollars and priority (need, want, wish) |
| **Life events** | Scenario events that change the plan |
| **IPS** | Objectives, profile, return target, horizon, liquidity, tax, legal, unique circumstances, targets with ranges, benchmark, rebalancing rule, risk limits, spending policy, fee, approvals |
| **Relationship** | Preferences, notes (date, category, summary), tasks, next meeting, last review snapshot |

**Estate inclusion follows ownership.** Individual, joint and revocable-trust assets are in the estate; irrevocable trusts, foundations, donor-advised funds, custodial accounts and 529 plans are not; an LLC inherits the status of whichever entity owns it.

## 4. The household model

Every household page shares one memoized model (`lib/data.ts`, `app/households/[id]/layout.tsx`):

1. **Quotes.** Live prices for every holding (`/api/quotes`), falling back to the last known price stored with each holding so pages render instantly.
2. **Valuation** (`value()`): positions at market; account totals; policy-portfolio weights across six asset classes; cash available to the family; liquid, illiquid and residential assets; debts; net worth; estate value; and ratios (debt to assets, months of cash, liquid assets to debt, illiquid share, savings rate).
3. **Plan** (`buildPlan()`): a year-by-year list of cash flows (savings until retirement; the withdrawal that leaves retirement spending after federal tax on withdrawals, other income and taxable Social Security; education, home and purchase goals; life events) plus return assumptions from the IPS targets.
4. **Simulation** (`simulate()`): 5,000 Monte Carlo paths by default.

## 5. The IPS as executable policy

`lib/ips.ts` turns the policy into code:

- **`compliance()`** checks allocation ranges, expected volatility, the worst historical stress loss, single-security concentration (diversified funds exempt), the cash reserve, the illiquid share, expected return after fees and the review date. Each rule is Compliant, Watch (within about 10% of the limit) or Breach.
- **`rebalance()`** first trims any single security above the position limit, then brings each sleeve back to target. Sells come from tax-deferred and Roth accounts first, then from taxable lots with the lowest gain (losses first). Buys follow asset-location preferences but use only cash raised in the same account, so money never moves between accounts. Bank and money-market accounts are never traded, and gaps under 0.5% of the portfolio are ignored.
- **`assetLocation()`** fills tax-deferred accounts with the sleeves that have the highest annual tax drag (tax on yield plus deferred tax on growth, at the household's own rates including the 3.8% NIIT, with municipal bonds as the taxable alternative), Roth accounts with the highest expected return, and taxable accounts with the rest, then compares the tax drag with the current placement.
- **`harvest()`** finds taxable positions more than 3% and $1,000 below cost and pairs each with a fund tracking a different index.

The same IPS feeds the risk questionnaire (which can rewrite the profile and targets), the investment committee (whose tilts are clamped to each family's ranges), the meeting brief and the PDF report.

## 6. Monte Carlo engine

`lib/montecarlo.ts`:

- **Returns.** Each year's nominal return is drawn from a lognormal distribution matched to the policy mix's arithmetic mean (net of the advisory fee) and volatility, computed as wᵀΣw from six asset classes and a correlation matrix, then deflated by 2.5% inflation. All results are in today's dollars.
- **Cash flows.** Applied at the start of each year: inflows first, then outflows in goal-priority order. A goal succeeds on a path only if it is paid in full; retirement succeeds if spending is met every year to the planning age; the legacy goal succeeds if ending wealth plus assets passing to heirs (property, private holdings, family trusts) meets the target.
- **Life events.** A market crash replaces the random draw for that year; job loss removes the earner's after-tax pay; an inflation spike lowers real returns in proportion to the nominal share of the portfolio; divorce transfers assets and cuts savings and spending; home purchases, new children and inheritances add cash flows.
- **Performance.** A seeded generator (mulberry32 plus Box-Muller) makes results repeatable. 10,000 paths over 70 years run in about 60 milliseconds, so the plan recalculates on every edit.
- **Outputs.** Per-goal probability, depletion probability and typical depletion year, percentile bands (5/25/50/75/95) for the fan chart, the ending-wealth distribution, and worst, 5th percentile, median, 95th percentile and best outcomes.

`withdrawalSuccess()` reuses the same engine with a $1 portfolio for the withdrawal-rate grid (6 rates × 5 horizons × 1,500 paths).

## 7. Planning, tax and estate

- **Tax** (`lib/tax.ts`): 2026 ordinary brackets for three filing statuses, the standard deduction, capital gains brackets and the NIIT; Social Security PIA from the 90/32/15 formula with 2026 bend points, full retirement age by birth year, early-claiming reductions and delayed credits, a spousal benefit with its own reduction schedule, and the provisional-income test for taxing benefits.
- **Retirement gap:** projected assets at retirement at the median real return against the present value of all later withdrawals, and the extra annual saving that would close any gap.
- **Education:** College Board tuition plus a living-cost assumption, inflating 3.5% a year; 529 balances projected; the level monthly contribution to fully fund each goal.
- **Affordability:** the 28/36 rule at the latest 30-year mortgage rate from FRED.
- **Estate:** assets inside the estate grow to the second death; the exclusion is doubled with portability; annual exclusion gifts and trust transfers move growth outside the estate; charitable bequests are deductible; 40% tax above the exclusion. Results are compared with doing nothing and drawn as a Sankey chart.

## 8. Risk and stress testing

- **Profile** (`lib/risk.ts`): willingness from an eight-question questionnaire; capacity from time horizon, cash reserve, plan cushion and debt load, capped at Moderate within five years of retirement; the final profile is the more conservative of the two.
- **Heat map:** ten dimensions (market, interest rate, inflation, concentration, technology, liquidity, sequence of returns, longevity, borrowing, estate tax), each scored 1–5 by an explicit formula and labeled with its driver.
- **Historical stress** (`lib/server/stress.ts`, `lib/stress.ts`): four crisis windows (dot-com, 2008, COVID, 2022). The server fetches each asset class's long-history proxy (Vanguard 500 Index, Total International, Total Bond Market, REIT Index, Short-Term Treasury, gold futures) from the window's start through up to six years later; the browser replays today's weights to find the worst loss and the months to recovery.
- **Hypothetical shocks:** a 2-point rate rise (bond loss = duration × 2%), an inflation shock and an equity bear market.

## 9. Markets and research

- **Regime** (`lib/regime.ts`): Expansion, Recovery, Late cycle, Recession or Stagflation from GDP, CPI, the Sahm rule and the yield curve, with quarterly history since 2008.
- **Investment committee:** each sleeve starts from the regime's baseline and is adjusted by explicit signals (curve inversion, S&P 500 valuation and 200-day trend, inflation persistence, real yields, credit spreads, VIX, T-bills against inflation). Tactical tilts are 2.5 points per step, clamped inside every household's IPS ranges.
- **N-PORT** (`lib/server/nport.ts`): ticker → series ID (`company_tickers_mf.json`) → latest NPORT-P filing (EDGAR's series-level Atom feed) → raw `primary_doc.xml` (not the XSL-rendered copy) → every position with value, weight, asset category, issuer type and country. Filings over 4 MB compressed (the largest bond funds) fall back to Yahoo's top holdings.
- **Look-through** (`lib/use-lookthrough.ts`): combines each fund's sector weights and top holdings with position sizes to estimate sector exposure and the largest underlying companies. This feeds the technology row of the heat map.

## 10. Caching and data fetching

| Layer | Lifetime |
|---|---|
| CDN (`s-maxage` + `stale-while-revalidate`) | quotes 15 min; prices 3 h; macro 6 h; fund data 12 h; N-PORT and stress 24 h |
| Server promise cache (`memo`) | matching lifetimes; failures evicted immediately |
| Client URL cache (`fetchJson`) | the browser session, so moving between tabs doesn't refetch |

Responses without FRED data are marked `no-store`, and environment variables are trimmed, lessons carried over from Intrinsic's first production incident.

## 11. Frontend

- **Next.js 16 App Router** with client components. The household layout loads the model once and provides it through React context to twelve tabs.
- **UI:** Tailwind CSS 4 with one dark theme defined as CSS variables, shadcn/ui on Base UI (button and dialog only), Lucide icons, Geist for the interface and Instrument Serif for headings.
- **Charts:** Plotly figures built in `lib/charts.ts`; `lightFig()` recolors any figure for the white PDF page.
- **Tailwind scanning:** folders are registered explicitly with `@source`, because automatic detection skipped the dynamic `[id]` route folder (see the development log).

## 12. Module map

```
app/
  page.tsx                   advisor dashboard
  households/                book of business and the intake form
  households/[id]/           layout (model + tabs) and 12 tabs
  relationships/             CRM across the book
  markets/, committee/       economic regime, investment committee
  research/, watchlist/      fund analysis (N-PORT), watchlist
  methodology/               every formula and source
  api/                       quotes, prices, fund, nport, macro, stress, health
components/                  Shell, kit (UI primitives), widgets, Plot
lib/
  types.ts, seed.ts, store.ts, new-household.ts
  reference.ts, cma.ts, format.ts
  household.ts, tax.ts, montecarlo.ts, planning.ts
  ips.ts, risk.ts, stress.ts, regime.ts, brief.ts, timeline.ts, analytics.ts
  data.ts, household-context.tsx, use-stress.ts, use-lookthrough.ts
  charts.ts, pdf.ts
  server/                    cache, yahoo, macro, nport, stress
```
