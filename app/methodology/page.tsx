import { PageHeader, Panel } from "@/components/kit";
import { CLASS_LABEL, CLASSES, CMA, CORR, INFLATION, MODEL } from "@/lib/cma";
import { BRACKETS, COLLEGE_INFLATION, ESTATE, LIMITS, LIVING_COST_ASSUMPTION, LTCG, SOURCES, SSA, STANDARD_DEDUCTION, TAX_YEAR, TUITION } from "@/lib/reference";

export const metadata = { title: "Methodology · Family Office OS" };

const p = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;
const d = (v: number) => (Number.isFinite(v) ? `$${v.toLocaleString("en-US")}` : "and above");

const MODELS: [string, string[]][] = [
  ["Balance sheet", [
    "Net worth = liquid accounts at market + real and private assets at their last valuation − liabilities.",
    "Debt ratio = liabilities ÷ total assets. Liquidity ratio = cash in spendable accounts ÷ monthly living expenses (months of reserve).",
    "Illiquid share = private equity, venture, investment real estate, businesses, art and aircraft ÷ (total assets − residences).",
    "Estate inclusion follows the owning entity: individual, joint and revocable-trust assets (and LLCs they own) are in the estate; irrevocable trusts, foundations, donor-advised funds, custodial accounts and 529 plans are not.",
  ]],
  ["Expected return and risk", [
    "Portfolio expected return = Σ wᵢμᵢ over six asset classes; variance = wᵀΣw with Σᵢⱼ = ρᵢⱼσᵢσⱼ.",
    "Risk contribution of class i = wᵢ(Σw)ᵢ ÷ wᵀΣw, so contributions add to 100%.",
    "Sharpe ratio = (expected return − 3-month T-bill yield from FRED) ÷ volatility.",
  ]],
  ["Monte Carlo simulation", [
    "Each year's nominal portfolio return is drawn from a lognormal distribution matched to the policy mix's arithmetic mean (net of the advisory fee) and volatility, then deflated by 2.5% inflation, so everything is in today's dollars.",
    "Cash flows are applied at the start of each year: savings until the primary client retires; after retirement, spending minus Social Security and other income, grossed up for federal income tax; education costs (growing 1% a year faster than inflation); home and other purchases.",
    "Within a year, inflows come first and outflows are paid in goal-priority order (essential, then discretionary, then aspirational). A goal succeeds on a path only if it is paid in full; retirement succeeds if spending is met every year to the planning age; the legacy goal succeeds if ending wealth plus assets passing to heirs meets the target.",
    "Probability of success = successful paths ÷ total paths (1,000, 5,000 or 10,000). A seeded random number generator makes results repeatable.",
    "Life events: a market crash replaces that year's draw; job loss removes the earner's after-tax pay (70% of gross) from savings; an inflation spike lowers real returns by the surprise times the nominal share of the portfolio plus half the equity share; divorce transfers a share of assets, halves savings and cuts spending to 65%; home purchases, new children and inheritances add cash flows.",
  ]],
  ["Retirement engine", [
    "Projected assets at retirement grow current investable assets and savings at the median real return, (1 + μ − σ²/2) ÷ (1 + inflation) − 1.",
    "Needed at retirement = present value at retirement of every later withdrawal at the same return. Surplus or shortfall = projected − needed.",
    "Extra savings to close a shortfall = shortfall × r ÷ ((1 + r)ⁿ − 1). The withdrawal-rate grid runs 1,500 simulations for each rate and horizon at the policy mix.",
  ]],
  ["Social Security", [
    `PIA = 90% of AIME up to ${d(SSA.bend1)} + 32% up to ${d(SSA.bend2)} + 15% above (2026 bend points). AIME is approximated as current earnings, capped at the ${d(SSA.wageBase)} wage base, ÷ 12.`,
    "Claiming before 67 reduces the benefit by 5/9 of 1% a month for 36 months and 5/12 of 1% beyond; delayed retirement credits add 8% a year to 70. A spouse without earnings receives up to 50% of the worker's PIA.",
  ]],
  ["Education, housing and estate", [
    `College cost = College Board 2025–26 published tuition and fees + a ${d(LIVING_COST_ASSUMPTION)} living-cost assumption, inflating ${p(COLLEGE_INFLATION)} a year. Monthly contribution solves for the level saving that funds the present value of costs at the first tuition bill.`,
    "Home affordability applies the 28/36 rule: housing cost ≤ 28% of gross monthly income and all debt payments ≤ 36%, at the latest 30-year mortgage rate from FRED, with property tax and insurance at 1.5% of value a year.",
    `Estate tax = 40% × (estate at the second death − charitable bequests − exclusion). The exclusion is ${d(ESTATE.exclusion)} per person (doubled for married couples through portability). Annual exclusion gifts of ${d(ESTATE.annualGift)} per donor per recipient leave the estate and compound for heirs.`,
  ]],
  ["Investment policy engine", [
    "Every IPS rule is evaluated live: allocation ranges, expected volatility, loss in the worst historical stress, single-security limit (funds exempt), cash reserve, illiquid share, expected return after fees and the annual review date. Each is Compliant, Watch (within about 10% of the limit) or Breach.",
    "Rebalancing sells overweight sleeves in tax-deferred and Roth accounts first, then taxable lots with the lowest gain; buys follow asset-location preferences using only cash raised in the same account.",
    "Asset location fills tax-deferred accounts with the highest annual tax drag (yield × ordinary rate for bonds, REITs and cash), Roth accounts with the highest expected return, and taxable accounts with the rest. Savings = tax drag of the current placement − tax drag of the optimized one.",
    "Tax-loss harvesting flags taxable positions more than 3% and $1,000 below cost and pairs each with a fund tracking a different index.",
  ]],
  ["Risk", [
    "Willingness = questionnaire score scaled to 0–100. Capacity = average of time horizon, cash reserve, plan cushion (retirement probability) and debt load. The recommended profile is the more conservative of the two: below 40 Conservative, 40–69 Moderate, 70+ Aggressive.",
    "The heat map scores ten dimensions from 1 to 5 with stated formulas: volatility against the IPS limit, portfolio duration, nominal-asset share and CPI, largest single stock, technology share after fund look-through, cash and illiquidity, years to retirement × equity share, plan success, leverage and estate size against the exclusion.",
    "Historical stress tests replay today's weights through the dot-com bust, 2008, the 2020 COVID crash and 2022, using long-history index funds: Vanguard 500 Index (U.S.), Total International Stock (international), Total Bond Market (bonds), REIT Index (real estate), gold futures (alternatives) and Short-Term Treasury (cash).",
  ]],
  ["Performance analytics", [
    "Current holdings are held at today's weights and rebalanced daily over the window; cash earns the T-bill yield.",
    "CAGR = ending value^(1/years) − 1. Downside deviation uses daily returns below the risk-free rate. Sortino = (CAGR − risk-free) ÷ downside deviation. Beta = cov(portfolio, SPY) ÷ var(SPY). Maximum drawdown is the deepest peak-to-trough decline.",
    "Performance contribution = weight × annualized return; risk contribution = weight × cov(holding, portfolio) ÷ var(portfolio).",
  ]],
  ["Economic regime and investment committee", [
    "Stagflation: CPI above 3.5% with GDP below 1% or a Sahm reading of 0.3+. Recession: negative real GDP or the Sahm rule (3-month average unemployment 0.5 points above its 12-month low). Recovery: positive growth with unemployment elevated and falling. Expansion: GDP of 1.5%+. Otherwise late cycle.",
    "The committee starts each sleeve from the regime's baseline view and adjusts it for yield-curve inversion, S&P 500 valuation and trend, inflation persistence, real yields, credit spreads and volatility. Tactical tilts are 2.5 points per step and never leave a household's IPS range.",
  ]],
];

export default function Methodology() {
  return (
    <>
      <PageHeader eyebrow="Reference" title="Methodology" sub="Every number in the platform comes from a stated source or formula. Nothing is a black box, and no language model is involved." />
      <div className="grid gap-4 xl:grid-cols-2">
        {MODELS.map(([t, lines]) => (
          <Panel key={t} title={t}>
            <ul className="space-y-2 text-[13px] leading-relaxed text-foreground/85">{lines.map((l) => <li key={l} className="flex gap-2.5"><span className="mt-2 size-1 shrink-0 rounded-full bg-gold" />{l}</li>)}</ul>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Capital market assumptions" sub={`Nominal, annual; inflation ${p(INFLATION)}`} pad={false}>
          <table className="grid-table">
            <thead><tr><th>Asset class</th><th className="r">Expected return</th><th className="r">Volatility</th><th className="r">Yield</th><th>Historical proxy</th><th>Model fund</th></tr></thead>
            <tbody>{CLASSES.map((c) => <tr key={c}><td>{CLASS_LABEL[c]}</td><td className="r">{p(CMA[c].mean)}</td><td className="r">{p(CMA[c].vol)}</td><td className="r">{p(CMA[c].yield)}</td><td className="text-muted-foreground">{CMA[c].proxy}</td><td className="text-muted-foreground">{CMA[c].model}</td></tr>)}</tbody>
          </table>
          <div className="overflow-x-auto px-5 pt-4 pb-5">
            <div className="eyebrow mb-2">Correlations</div>
            <table className="grid-table">
              <thead><tr><th />{CLASSES.map((c) => <th key={c} className="r">{CLASS_LABEL[c].split(" ")[0]}</th>)}</tr></thead>
              <tbody>{CLASSES.map((a, i) => <tr key={a}><td>{CLASS_LABEL[a]}</td>{CLASSES.map((b, j) => <td key={b} className="r text-muted-foreground">{CORR[i][j].toFixed(2)}</td>)}</tr>)}</tbody>
            </table>
            <p className="mt-3 text-[12px] text-muted-foreground">Round numbers in the range of published 10-year assumptions from large asset managers. They live in one file (lib/cma.ts) and every model reads them from there.</p>
          </div>
        </Panel>
        <Panel title="Model allocations by risk profile" pad={false}>
          <table className="grid-table">
            <thead><tr><th>Profile</th>{CLASSES.map((c) => <th key={c} className="r">{CLASS_LABEL[c].split(" ")[0]}</th>)}</tr></thead>
            <tbody>{(["Conservative", "Moderate", "Aggressive"] as const).map((k) => <tr key={k}><td>{k}</td>{CLASSES.map((c) => <td key={c} className="r">{p(MODEL[k][c], 0)}</td>)}</tr>)}</tbody>
          </table>
          <div className="px-5 pt-4 pb-5">
            <div className="eyebrow mb-2">Published figures used ({TAX_YEAR})</div>
            <table className="grid-table">
              <tbody>
                <tr><td>Standard deduction</td><td className="r">{d(STANDARD_DEDUCTION.single)} single · {d(STANDARD_DEDUCTION.mfj)} joint · {d(STANDARD_DEDUCTION.hoh)} head of household</td></tr>
                <tr><td>0% / 15% capital gains thresholds (joint)</td><td className="r">{d(LTCG.mfj[0])} / {d(LTCG.mfj[1])}</td></tr>
                <tr><td>401(k) / IRA limits</td><td className="r">{d(LIMITS.k401)} (+{d(LIMITS.k401CatchUp)} at 50) / {d(LIMITS.ira)}</td></tr>
                <tr><td>Estate exclusion / annual gift exclusion</td><td className="r">{d(ESTATE.exclusion)} / {d(ESTATE.annualGift)}</td></tr>
                <tr><td>Social Security bend points / wage base</td><td className="r">{d(SSA.bend1)}, {d(SSA.bend2)} / {d(SSA.wageBase)}</td></tr>
                {Object.entries(TUITION).map(([k, v]) => <tr key={k}><td>Tuition and fees, {k.toLowerCase()}</td><td className="r">{d(v)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Federal income tax brackets" sub="Married filing jointly, 2026" pad={false}>
          <table className="grid-table">
            <thead><tr><th>Taxable income up to</th><th className="r">Rate</th></tr></thead>
            <tbody>{BRACKETS.mfj.map(([up, r]) => <tr key={r}><td>{d(up)}</td><td className="r">{p(r, 0)}</td></tr>)}</tbody>
          </table>
        </Panel>
        <Panel title="Data sources" pad={false}>
          <table className="grid-table">
            <thead><tr><th>Source</th><th>Used for</th></tr></thead>
            <tbody>{SOURCES.map((s) => <tr key={s.name}><td><a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-gold">{s.name}</a></td><td className="text-muted-foreground">{s.what}</td></tr>)}</tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Limitations" className="mt-4">
        <ul className="grid gap-2 text-[13px] text-muted-foreground md:grid-cols-2">
          <li>Federal taxes only; state income and estate taxes are not modeled.</li>
          <li>Social Security uses current earnings as a proxy for a full earnings record; SSA statements are more precise.</li>
          <li>Returns are independent from year to year; real markets show streaks and regime shifts.</li>
          <li>Private assets are carried at their last appraisal and do not move with markets.</li>
          <li>Yahoo Finance is free but unofficial; missing data is shown as missing rather than estimated.</li>
          <li>Household data is stored in the browser; a production system would use an encrypted database with access controls.</li>
        </ul>
      </Panel>
    </>
  );
}
