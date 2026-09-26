// Risk profiling (willingness from a questionnaire, capacity from the balance sheet) and the household risk heat map.
import { DURATION, isFund, MODEL, portfolioStats } from "./cma";
import { pct } from "./format";
import { yearsToRetire, type Valuation } from "./household";
import { ESTATE } from "./reference";
import type { Household, RiskProfile } from "./types";

export const QUESTIONS: { id: string; q: string; options: string[] }[] = [
  { id: "experience", q: "How much investing experience do you have?", options: ["None", "Some: savings and retirement plans", "Experienced: I manage a diversified portfolio", "Extensive: including private and alternative investments"] },
  { id: "knowledge", q: "How well do you understand the relationship between risk and return?", options: ["Not at all", "Basic understanding", "Good understanding", "Professional-level understanding"] },
  { id: "horizon", q: "When do you expect to need most of this money?", options: ["Within 3 years", "3 to 7 years", "7 to 15 years", "More than 15 years"] },
  { id: "drawdown", q: "What is the largest one-year decline you could accept without changing course?", options: ["5%", "15%", "25%", "35% or more"] },
  { id: "reaction", q: "Your portfolio falls 20% in a quarter. What do you do?", options: ["Sell everything", "Sell some to reduce risk", "Hold and wait", "Buy more at lower prices"] },
  { id: "goal", q: "Which statement best describes your return expectations?", options: ["Protect what I have, even if it barely beats inflation", "Modest growth with limited swings", "Solid long-term growth with normal market swings", "Maximum long-term growth; volatility doesn't bother me"] },
  { id: "income", q: "How stable is your income over the next five years?", options: ["Uncertain", "Somewhat stable", "Stable", "Very stable, with a surplus to invest"] },
  { id: "liquidity", q: "How much of this portfolio might you need for emergencies?", options: ["Most of it", "A meaningful part", "A small part", "None: other reserves cover emergencies"] },
];

const band = (score: number): RiskProfile => (score < 40 ? "Conservative" : score < 70 ? "Moderate" : "Aggressive");
const ORDER: RiskProfile[] = ["Conservative", "Moderate", "Aggressive"];

/** Score 0–100 from answers (each 0–3), capacity from the plan, and a final profile = the more conservative of the two. */
export function assess(answers: Record<string, number>, h: Household, v: Valuation, retirementProbability?: number) {
  const vals = QUESTIONS.map((q) => answers[q.id] ?? 1);
  const willingness = Math.round((vals.reduce((a, b) => a + b, 0) / (QUESTIONS.length * 3)) * 100);
  const yrs = yearsToRetire(h);
  const parts = [
    { name: "Time horizon", score: Math.min(100, (yrs / 20) * 100), note: `${yrs} years to retirement` },
    { name: "Liquidity reserve", score: Math.min(100, (v.ratios.liquidityMonths / Math.max(1, h.ips.liquidityMonths)) * 70), note: `${v.ratios.liquidityMonths.toFixed(1)} months of cash` },
    { name: "Plan cushion", score: retirementProbability == null ? 60 : Math.min(100, Math.max(0, (retirementProbability - 0.5) * 200)), note: retirementProbability == null ? "Run the plan to include" : `${pct(retirementProbability, 0)} retirement success` },
    { name: "Debt load", score: Math.max(0, 100 - v.ratios.debtToAssets * 200), note: `${pct(v.ratios.debtToAssets, 0)} debt to assets` },
  ];
  // Within five years of retirement, a large loss can't be waited out: capacity is capped at Moderate.
  const capacity = Math.round(Math.min(yrs < 5 ? 69 : 100, parts.reduce((s, p) => s + p.score, 0) / parts.length));
  const w = band(willingness), c = band(capacity);
  const profile = ORDER[Math.min(ORDER.indexOf(w), ORDER.indexOf(c))];
  return { willingness, capacity, parts, willingnessProfile: w, capacityProfile: c, profile, allocation: MODEL[profile] };
}

export type Level = "Low" | "Moderate" | "Elevated" | "High";
export type HeatCell = { name: string; score: number; level: Level; driver: string; action: string };

const level = (s: number): Level => (s < 1.75 ? "Low" : s < 2.75 ? "Moderate" : s < 3.75 ? "Elevated" : "High");
const cell = (name: string, score: number, driver: string, action: string): HeatCell => ({ name, score: Math.max(1, Math.min(5, score)), level: level(score), driver, action });

/** Ten household risk dimensions, each scored 1 (low) to 5 (high) from explicit rules. */
export function heatMap(h: Household, v: Valuation, o: { retirementProbability?: number; cpi?: number | null; techShare?: number | null } = {}) {
  const w = v.policyWeights, stats = portfolioStats(w);
  const bondFunds = v.positions.filter((p) => p.account.inPolicy && p.cls === "bonds");
  const bondValue = bondFunds.reduce((s, p) => s + p.value, 0);
  const duration = bondValue ? bondFunds.reduce((s, p) => s + p.value * (DURATION[p.symbol] ?? 6), 0) / bondValue : 0;
  const portDuration = duration * w.bonds;
  const single = v.positions.filter((p) => p.account.inPolicy && p.symbol !== "$CASH" && !isFund(p.symbol));
  const bySym = new Map<string, number>();
  single.forEach((p) => bySym.set(p.symbol, (bySym.get(p.symbol) ?? 0) + p.value));
  const [topSym, topVal] = [...bySym.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const top = v.policy ? topVal / v.policy : 0;
  const yrs = yearsToRetire(h), equity = w.us + w.intl;
  const variable = h.liabilities.filter((l) => l.kind === "credit-line").reduce((s, l) => s + l.balance, 0);
  const exclusion = ESTATE.exclusion * (h.marital === "Married" ? 2 : 1);
  const cpi = o.cpi ?? 3;

  return [
    cell("Market", 1 + (stats.vol / h.ips.limits.maxVolatility) * 3, `Expected volatility ${pct(stats.vol)} against a ${pct(h.ips.limits.maxVolatility, 0)} limit`, "Keep equity within policy bands; rebalance after large moves."),
    cell("Interest rate", 1 + portDuration * 0.8, `Bond duration ${duration.toFixed(1)} years on a ${pct(w.bonds, 0)} bond sleeve (${portDuration.toFixed(1)} years overall)`, "Shorten duration or ladder maturities if rate volatility is a concern."),
    cell("Inflation", 1 + (w.bonds + w.cash) * 3 + (cpi > 3 ? 1 : 0) - (w.realestate + w.alts) * 4, `${pct(w.bonds + w.cash, 0)} in nominal assets; CPI running at ${cpi.toFixed(1)}%`, "Add TIPS, real estate or commodities as an inflation hedge."),
    cell("Concentration", top ? 1 + (top / h.ips.limits.maxPosition) * 2.2 : 1, topVal ? `${topSym} is ${pct(top)} of the portfolio (limit ${pct(h.ips.limits.maxPosition, 0)})` : "No single-stock positions", "Stage sales across tax years, gift appreciated shares, or use an exchange fund."),
    cell("Technology", o.techShare == null ? 2 : 1 + o.techShare * 8, o.techShare == null ? "Look-through data loading" : `${pct(o.techShare, 0)} of equity exposure in technology after looking through funds`, "Balance with value and international equity."),
    cell("Liquidity", 1 + Math.max(0, 1 - v.ratios.liquidityMonths / Math.max(1, h.ips.liquidityMonths)) * 2.5 + v.ratios.illiquidShare * 2.5, `${v.ratios.liquidityMonths.toFixed(1)} months of cash; ${pct(v.ratios.illiquidShare, 0)} of investable wealth is illiquid`, "Hold the policy cash reserve; pace private commitments."),
    cell("Sequence of returns", yrs > 10 ? 1.5 : 1 + (equity / 0.6) * (1 - yrs / 12) * 3, yrs > 10 ? `${yrs} years to retirement` : `${yrs} years to retirement with ${pct(equity, 0)} in equities`, "Build a 2–3 year spending reserve before retirement."),
    cell("Longevity", o.retirementProbability == null ? 2.5 : 1 + (1 - o.retirementProbability) * 8, o.retirementProbability == null ? "Plan not yet run" : `${pct(o.retirementProbability, 0)} probability the plan lasts to the planning age`, "Delay Social Security to 70; consider an income annuity for essential spending."),
    cell("Borrowing", 1 + v.ratios.debtToAssets * 6 + (variable > 0 ? 0.8 : 0), `${pct(v.ratios.debtToAssets, 0)} debt to assets${variable ? `; ${pct(variable / Math.max(1, v.debt), 0)} at variable rates` : ""}`, "Pay down variable-rate lines as rates rise."),
    cell("Estate tax", v.estate > exclusion ? 2 + Math.min(3, ((v.estate - exclusion) / exclusion) * 3) : 1 + (v.estate / exclusion) * 1.2, `Estate of ${(v.estate / 1e6).toFixed(1)}M against a ${(exclusion / 1e6).toFixed(0)}M exclusion`, "Annual exclusion gifts, trust transfers and charitable bequests."),
  ];
}
