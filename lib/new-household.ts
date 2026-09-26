// Build a complete household from the intake form: people, accounts invested in the model portfolio, goals and an IPS.
import { band, CLASSES, CMA, MODEL } from "./cma";
import { thisYear, today, uid } from "./format";
import type { Account, FilingStatus, Holding, Household, RiskProfile } from "./types";

export type Intake = {
  family: string; state: string; filing: FilingStatus; profile: RiskProfile;
  primary: { name: string; dob: string; income: number; retireAge: number };
  spouse?: { name: string; dob: string; income: number; retireAge: number };
  expenses: number; savings: number; retirementSpending: number;
  taxable: number; deferred: number; roth: number; cash: number;
  homeGoal?: { year: number; amount: number };
};

/** Seed holdings at a nominal $1 price per share; live quotes revalue them on first load. */
const mix = (amount: number, profile: RiskProfile, prices: Record<string, number>): Holding[] =>
  CLASSES.filter((c) => c !== "cash" && MODEL[profile][c] > 0).map((c) => {
    const symbol = CMA[c].model, value = (amount * MODEL[profile][c]) / (1 - MODEL[profile].cash), price = prices[symbol] ?? 100;
    return { symbol, shares: +(value / price).toFixed(3), basis: Math.round(value), price };
  });

export function newHousehold(f: Intake, prices: Record<string, number> = {}): Household {
  const id = `${f.family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${uid().slice(0, 4)}`;
  const p1 = { id: uid(), name: f.primary.name, relationship: "client" as const, dob: f.primary.dob, income: f.primary.income, retireAge: f.primary.retireAge, planToAge: 95, ssClaimAge: 67 };
  const p2 = f.spouse?.name ? { id: uid(), name: f.spouse.name, relationship: "spouse" as const, dob: f.spouse.dob, income: f.spouse.income, retireAge: f.spouse.retireAge, planToAge: 95, ssClaimAge: 67 } : null;
  const ent = { joint: { id: "e-joint", name: `${p1.name} & ${p2?.name} (joint)`, type: "joint" as const }, p1: { id: "e-p1", name: p1.name, type: "individual" as const } };
  const shared = p2 ? ent.joint.id : ent.p1.id;
  const account = (name: string, tax: Account["tax"], amount: number, entity: string): Account | null =>
    amount > 0 ? { id: uid(), name, entity, custodian: "Charles Schwab", tax, inPolicy: true, holdings: tax === "taxable" && name.includes("Cash") ? [{ symbol: "$CASH", shares: amount, basis: amount, price: 1 }] : mix(amount, f.profile, prices) } : null;
  const accounts = [
    account(p2 ? "Joint Brokerage" : "Brokerage", "taxable", f.taxable, shared),
    account("401(k) / IRA", "tax-deferred", f.deferred, ent.p1.id),
    account("Roth IRA", "tax-free", f.roth, ent.p1.id),
    account("Cash Reserve", "taxable", f.cash, shared),
  ].filter(Boolean) as Account[];
  const w = MODEL[f.profile];
  return {
    id, name: f.family, tier: "High net worth", state: f.state, filing: f.filing, marital: p2 ? "Married" : "Single", advisor: "Noah Williams", since: today(),
    people: [p1, ...(p2 ? [p2] : [])],
    expenses: f.expenses, savings: f.savings, retirementSpending: f.retirementSpending, otherIncome: 0,
    entities: p2 ? [ent.joint, ent.p1] : [ent.p1],
    accounts, other: [], liabilities: [],
    goals: [
      { id: uid(), type: "retirement", name: `Retire at ${f.primary.retireAge}`, year: Number(f.primary.dob.slice(0, 4)) + f.primary.retireAge, amount: f.retirementSpending, priority: 1, person: p1.id },
      ...(f.homeGoal && f.homeGoal.amount > 0 ? [{ id: uid(), type: "home" as const, name: "Home purchase", year: f.homeGoal.year, amount: f.homeGoal.amount, priority: 1 as const }] : []),
    ],
    events: [],
    ips: {
      effective: today(), lastReview: today(), profile: f.profile, objective: "Grow and protect the family's wealth to fund its goals, within the risk limits below.",
      returnTarget: f.profile === "Aggressive" ? 0.06 : f.profile === "Moderate" ? 0.05 : 0.04, timeHorizon: `${Number(f.primary.dob.slice(0, 4)) + f.primary.retireAge - thisYear()} years to retirement.`,
      liquidityMonths: 6, taxNotes: "Use tax-advantaged accounts first; place tax-inefficient assets in tax-deferred accounts.", legalNotes: "Discretionary management under the advisory agreement.", unique: "None recorded.",
      targets: CLASSES.map((c) => ({ cls: c, target: w[c], min: Math.max(0, +(w[c] - band(w[c])).toFixed(2)), max: +(w[c] + band(w[c])).toFixed(2) })),
      benchmark: "Blended index benchmark at policy weights", rebalancing: "Quarterly review; rebalance a sleeve when it moves outside its range.",
      limits: { maxVolatility: f.profile === "Aggressive" ? 0.15 : f.profile === "Moderate" ? 0.11 : 0.08, maxDrawdown: f.profile === "Aggressive" ? 0.35 : f.profile === "Moderate" ? 0.25 : 0.15, maxPosition: 0.1, maxIlliquid: 0.4 },
      spending: "Withdrawals follow the financial plan.", advisoryFee: 0.0075, approvedBy: [p1.name, p2?.name].filter(Boolean).join(", "),
    },
    preferences: [], notes: [{ id: uid(), date: today(), category: "Meeting", summary: "Discovery meeting. Household created from the intake form.", author: "Noah Williams" }], tasks: [{ id: uid(), title: "Complete the risk questionnaire with the clients", due: today(), done: false, priority: "High" }],
  };
}
