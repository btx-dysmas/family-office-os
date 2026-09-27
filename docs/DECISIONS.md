# Family Office OS: Design Decisions

Each decision records the situation, what I chose, what I considered instead and what it cost.

---

### 1. Build the platform around an Investment Policy Statement

**Context.** Most portfolio dashboards show numbers without saying whether those numbers are acceptable. Institutional investors work the other way: a written policy defines objectives and limits first, and every decision is measured against it.

**Decision.** Give every household a full IPS and make it data, not a document. Compliance, rebalancing, risk profiling, the investment committee, meeting briefs and client reports all read their rules from it.

**Alternatives.** A settings page with target weights; a static PDF policy.

**Consequences.** The platform can say "this is a breach" rather than just "this is 78%." Editing the policy changes behavior everywhere at once. It also meant writing the policy's rules as testable functions (`lib/ips.ts`).

### 2. The household, not the account, is the unit of analysis

**Decision.** Model people, entities with ownership links, accounts, real and private assets, liabilities and goals together, and derive everything else (net worth, estate inclusion, liquidity, plan) from that model.

**Alternatives.** An account-centric model like most brokerage tools.

**Consequences.** Questions like "what's in the estate?", "how much can the family actually spend?" and "which account should hold bonds?" become answerable. The data model is more complex, and the intake form has to build a complete household.

### 3. No database: the book lives in the browser

**Context.** A database means provisioning, migrations, authentication and cost, and free tiers pause or expire.

**Decision.** Store households in `localStorage` through a small external store (`useSyncExternalStore`), seeded with four demo families and resettable.

**Alternatives.** A free hosted database; a JSON file in the repository.

**Consequences.** Zero cost, instant reads, nothing to operate, and the demo works for anyone who opens the link. It's single-user and per-browser, which is right for a portfolio demo and wrong for production; the README says so, and the data model is ready to move into a database behind authentication.

### 4. All household calculations run in the browser

**Decision.** The server only fetches and caches public data; valuation, planning, compliance, rebalancing, risk and PDFs all run client-side.

**Consequences.** Client data never leaves the browser, and every edit recalculates instantly. That required fast engines; see decision 6.

### 5. Goal-based planning with priorities

**Context.** A single "probability of success" hides the trade-offs families actually face.

**Decision.** Every goal gets its own probability. Within a year, cash flows are paid in priority order (essential, then discretionary, then aspirational), so a shortfall hits aspirational goals first.

**Consequences.** Output reads the way advisors talk ("retirement 92%, vacation home 78%"), and life events show which goals they threaten.

### 6. A fast, seeded, portfolio-level Monte Carlo

**Decision.** Draw one lognormal portfolio return per year from the policy mix's expected return and volatility (wᵀΣw), rather than simulating each asset class separately; use a seeded generator.

**Alternatives.** Per-asset correlated draws (more realistic dispersion between sleeves, but several times the work per path); historical bootstrapping (limited history).

**Consequences.** 10,000 paths in about 60 ms, so plans recalculate as you type, and the same inputs always give the same answer. The trade-off is that rebalancing effects between sleeves aren't modeled inside the simulation.

### 7. Published figures compiled in, not scraped

**Context.** Tax brackets, contribution limits, the estate exclusion, Social Security bend points and tuition averages change once a year and have no reliable free API.

**Decision.** Keep them in one file (`lib/reference.ts`) with their sources, and check every figure against the official publication.

**Consequences.** Simple and reliable, with a once-a-year update. Checking caught one head-of-household bracket I had filled in from memory that was $25 off.

### 8. Real historical stress tests using long-history mutual funds

**Context.** Most ETFs didn't exist in 2000, so ETF prices can't replay the dot-com bust or the early 2008 crisis.

**Decision.** Use index mutual funds that did exist (Vanguard 500 Index, Total International Stock, Total Bond Market, REIT Index, Short-Term Treasury) and gold futures as asset-class proxies; replay today's weights in the browser to get the worst loss and recovery time.

**Alternatives.** Hardcoded scenario returns from articles; ETF data only from 2008.

**Consequences.** Every historical scenario comes from actual prices. Gold futures history starts in August 2000, so the dot-com scenario measures gold from that date, and the page says so.

### 9. Tax-aware, account-aware rebalancing

**Decision.** Trim concentrated positions first; sell in tax-advantaged accounts before taxable ones and the lowest-gain lots first; buy using only cash raised in the same account; follow asset-location preferences; never trade bank accounts; ignore gaps under 0.5%.

**Consequences.** The trades a real advisor could place, with an estimate of the tax they cost. The first version sold index funds in IRAs and left a 37% NVDA position untouched; see the development log.

### 10. SEC N-PORT for complete fund holdings

**Context.** Free sources publish only a fund's top ten holdings.

**Decision.** Resolve ticker → series ID → latest N-PORT filing → raw XML, and parse every position. Skip filings too large for a serverless function.

**Consequences.** Complete, official holdings for most ETFs and mutual funds (520 positions for VOO). The largest bond funds list tens of thousands of positions and fall back to top holdings.

### 11. Rules, not a language model, for briefs and the investment committee

**Decision.** Meeting briefs, committee views and all commentary come from explicit rules over computed numbers.

**Consequences.** Every sentence is traceable and reproducible, and nothing is invented. Rules can't discuss what they weren't written to detect, so they surface the numbers an advisor should talk about rather than replacing the conversation.

### 12. Capacity limits willingness

**Context.** A client can be eager to take risk without being able to afford a loss.

**Decision.** Score willingness from the questionnaire and capacity from the balance sheet and plan; take the more conservative profile; cap capacity at Moderate within five years of retirement.

**Consequences.** The Chen–Alvarez household scores Aggressive on willingness but Moderate on capacity because their plan is only 62% funded, which is exactly the conversation the advisor needs to have.

### 13. One dark theme and a restrained visual language

**Decision.** A single dark theme (low-glare surfaces, one warm gold accent, muted data colors), a serif for headings, tabular figures, no animation beyond loading states.

**Consequences.** It looks like a professional tool rather than a consumer app. Charts are recolored to a light theme only for the printed PDF.

### 14. Minimal UI dependencies

**Decision.** Use shadcn/ui only where it earns its place (buttons and dialogs) and keep the rest as small local components (`components/kit.tsx`). Unused generated components were deleted.

**Consequences.** A smaller bundle, fewer dependencies to update, and code that reads as one consistent style.
