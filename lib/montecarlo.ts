// Goal-based Monte Carlo. Everything runs in today's dollars: returns are drawn in nominal terms, then deflated.
import { INFLATION, portfolioStats, type Weights } from "./cma";
import { thisYear } from "./format";
import { clients, primary, retireYear, targetWeights, type Valuation } from "./household";
import { COLLEGE_INFLATION } from "./reference";
import { incomeTax, socialSecurity } from "./tax";
import type { Goal, Household, LifeEvent } from "./types";

// Seeded generator so a plan gives the same answer every time it is opened.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rand: () => number) {
  let spare: number | null = null;
  return () => {
    if (spare != null) { const s = spare; spare = null; return s; }
    const u = Math.max(rand(), 1e-12), v = rand(), r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

export type Flow = { year: number; amount: number; goal?: string; label: string; priority: number };

export type Plan = {
  start: number; // first projection year
  years: number;
  wealth: number; // starting investable assets
  weights: Weights;
  mean: number; // nominal arithmetic, after fees
  vol: number;
  inflation: number;
  flows: Flow[]; // positive = contribution, negative = spending need
  legacy?: Goal;
  /** Net worth outside the spendable portfolio that also passes to heirs (property, private holdings, family trusts), held flat in real terms. */
  heirAssets: number;
  retirementGoal?: string;
  shocks: Record<number, { forced?: number; realDrag?: number; haircut?: number }>;
  retireYear: number;
};

/** Build the cash-flow plan for a household: savings, retirement spending, goals and life events. */
export function buildPlan(h: Household, v: Valuation, events: LifeEvent[] = h.events): Plan {
  const start = thisYear(), me = primary(h), people = clients(h);
  const end = Math.max(...people.map((p) => Number(p.dob.slice(0, 4)) + (p.planToAge ?? 95)));
  const years = Math.max(1, end - start);
  const w = targetWeights(h), s = portfolioStats(w);
  const retire = retireYear(me);
  const flows: Flow[] = [];

  // Life-event adjustments that change the ongoing cash flows.
  const divorce = events.find((e) => e.type === "divorce");
  const spendScale = (y: number) => (divorce && y >= divorce.year ? 0.65 : 1);
  const saveScale = (y: number) => (divorce && y >= divorce.year ? 0.5 : 1);

  for (let y = start; y < start + years; y++) {
    if (y < retire) {
      let save = h.savings * saveScale(y);
      for (const e of events.filter((e) => e.type === "job-loss" && y >= e.year && y < e.year + (e.duration ?? 1))) {
        const p = h.people.find((x) => x.id === e.person) ?? me;
        save -= (p.income ?? 0) * 0.7; // lost after-tax pay comes out of savings first, then the portfolio
      }
      flows.push({ year: y, amount: save, label: "Savings", priority: 0 });
    } else {
      // Retirement need net of Social Security and other income, grossed up for federal tax on withdrawals.
      const ss = people.reduce((sum, p) => {
        const claimYear = Number(p.dob.slice(0, 4)) + (p.ssClaimAge ?? 67);
        return sum + (y >= claimYear && !(divorce && y >= divorce.year && p.id !== me.id) ? socialSecurity(p, people.find((x) => x.id !== p.id)).annual : 0);
      }, 0);
      const need = Math.max(0, h.retirementSpending * spendScale(y) - ss - h.otherIncome);
      const gross = need > 0 ? need / (1 - incomeTax(need, h.filing).effective) : 0;
      if (gross > 0) flows.push({ year: y, amount: -gross, label: "Retirement spending", goal: h.goals.find((g) => g.type === "retirement")?.id, priority: 1 });
    }
  }

  const realCollege = (1 + COLLEGE_INFLATION) / (1 + INFLATION) - 1;
  for (const g of h.goals) {
    if (g.type === "education") {
      for (let k = 0; k < (g.years ?? 4); k++) flows.push({ year: g.year + k, amount: -g.amount * (1 + realCollege) ** (g.year + k - start), goal: g.id, label: g.name, priority: g.priority });
    } else if (g.type === "home" || g.type === "purchase") {
      flows.push({ year: g.year, amount: -g.amount, goal: g.id, label: g.name, priority: g.priority });
    }
  }

  const shocks: Plan["shocks"] = {};
  const equity = w.us + w.intl, nominal = w.bonds + w.cash;
  for (const e of events) {
    if (e.type === "market-crash") shocks[e.year] = { ...shocks[e.year], forced: e.amount ?? -0.35 };
    if (e.type === "inflation-spike")
      for (let k = 0; k < (e.duration ?? 3); k++) {
        // Nominal assets lose the full surprise in real terms; equities pass roughly half of it through.
        const drag = (e.amount ?? 0.04) * (nominal + 0.5 * equity);
        shocks[e.year + k] = { ...shocks[e.year + k], realDrag: (shocks[e.year + k]?.realDrag ?? 0) + drag };
      }
    if (e.type === "divorce") shocks[e.year] = { ...shocks[e.year], haircut: e.amount ?? 0.5 };
    if (e.type === "inheritance") flows.push({ year: e.year, amount: e.amount ?? 0, label: "Inheritance", priority: 0 });
    if (e.type === "home-purchase") flows.push({ year: e.year, amount: -(e.amount ?? 0), label: "Home purchase", priority: 1 });
    if (e.type === "new-child")
      for (let k = 0; k < (e.duration ?? 18); k++) flows.push({ year: e.year + k, amount: -(e.amount ?? 18_000), label: "Child costs", priority: 1 });
  }

  return {
    start, years, wealth: v.investable, weights: w, mean: s.mean - h.ips.advisoryFee, vol: s.vol, inflation: INFLATION, flows,
    legacy: h.goals.find((g) => g.type === "legacy"), heirAssets: v.netWorth - v.investable - v.charitable, retirementGoal: h.goals.find((g) => g.type === "retirement")?.id, shocks, retireYear: retire,
  };
}

export type Result = ReturnType<typeof simulate>;

export function simulate(plan: Plan, runs = 5000, seed = 11) {
  const { start, years, mean, vol, inflation } = plan;
  const rand = gaussian(mulberry32(seed));
  // Lognormal with the requested arithmetic mean and volatility.
  const s2 = Math.log(1 + (vol / (1 + mean)) ** 2), mu = Math.log(1 + mean) - s2 / 2, sd = Math.sqrt(s2);

  const byYear = new Map<number, Flow[]>();
  plan.flows.forEach((f) => byYear.set(f.year, [...(byYear.get(f.year) ?? []), f]));
  byYear.forEach((fs) => fs.sort((a, b) => b.amount - a.amount || a.priority - b.priority)); // inflows first, then by priority

  const goalIds = [...new Set(plan.flows.filter((f) => f.goal).map((f) => f.goal!))];
  const wins = new Map<string, number>(goalIds.map((g) => [g, 0]));
  let legacyWins = 0;
  const depletedAt: number[] = [];
  const paths = Array.from({ length: years + 1 }, () => new Float64Array(runs));
  const ending = new Float64Array(runs);

  for (let n = 0; n < runs; n++) {
    let w = plan.wealth;
    const failed = new Set<string>();
    let depleted: number | null = null;
    paths[0][n] = w;
    for (let k = 0; k < years; k++) {
      const y = start + k, shock = plan.shocks[y];
      if (shock?.haircut) w *= 1 - shock.haircut;
      for (const f of byYear.get(y) ?? []) {
        if (f.amount >= 0) { w += f.amount; continue; }
        const paid = Math.min(w, -f.amount);
        w -= paid;
        if (paid < -f.amount * 0.999) {
          if (f.goal) failed.add(f.goal);
          if (f.label === "Retirement spending" && depleted == null) depleted = y;
        }
      }
      const nominal = shock?.forced ?? Math.exp(mu + sd * rand()) - 1;
      const real = (1 + nominal) / (1 + inflation) - 1 - (shock?.realDrag ?? 0);
      w = Math.max(0, w * (1 + real));
      paths[k + 1][n] = w;
    }
    goalIds.forEach((g) => !failed.has(g) && wins.set(g, wins.get(g)! + 1));
    if (plan.legacy && w + plan.heirAssets >= plan.legacy.amount) legacyWins++;
    if (depleted != null) depletedAt.push(depleted);
    ending[n] = w;
  }

  const qs = [0.05, 0.25, 0.5, 0.75, 0.95];
  const bands = qs.map(() => [] as number[]);
  for (const col of paths) {
    const sorted = Float64Array.from(col).sort();
    qs.forEach((q, i) => bands[i].push(sorted[Math.round(q * (runs - 1))]));
  }
  const sortedEnd = Float64Array.from(ending).sort();
  const at = (q: number) => sortedEnd[Math.round(q * (runs - 1))];
  const probability: Record<string, number> = Object.fromEntries(goalIds.map((g) => [g, wins.get(g)! / runs]));
  if (plan.legacy) probability[plan.legacy.id] = legacyWins / runs;
  const retirement = plan.retirementGoal ? probability[plan.retirementGoal] ?? 1 : 1 - depletedAt.length / runs;

  return {
    runs,
    years: Array.from({ length: years + 1 }, (_, i) => start + i),
    bands,
    probability,
    success: retirement,
    depletion: depletedAt.length / runs,
    medianDepletionYear: depletedAt.length ? [...depletedAt].sort((a, b) => a - b)[Math.floor(depletedAt.length / 2)] : null,
    ending: { worst: sortedEnd[0], p5: at(0.05), p10: at(0.1), median: at(0.5), p90: at(0.9), p95: at(0.95), best: sortedEnd[runs - 1] },
    endingSample: Array.from(sortedEnd.filter((_, i) => i % Math.max(1, Math.floor(runs / 2000)) === 0)),
  };
}

/** Median real return implied by the plan (geometric), used by the deterministic projections. */
export const medianReal = (p: Plan) => (1 + p.mean - p.vol ** 2 / 2) / (1 + p.inflation) - 1;

/** Probability that a portfolio sustains a fixed real withdrawal rate for `horizon` years at the given mix. */
export function withdrawalSuccess(weights: Weights, fee: number, rate: number, horizon: number, runs = 1500) {
  const s = portfolioStats(weights);
  const plan: Plan = {
    start: 0, years: horizon, wealth: 1, heirAssets: 0, weights, mean: s.mean - fee, vol: s.vol, inflation: INFLATION, shocks: {}, retireYear: 0,
    flows: Array.from({ length: horizon }, (_, y) => ({ year: y, amount: -rate, label: "Retirement spending", goal: "r", priority: 1 })), retirementGoal: "r",
  };
  return simulate(plan, runs, 3).success;
}

