// Deterministic planning tools: retirement gap, education funding, home affordability and estate transfer.
import { portfolioStats } from "./cma";
import { sum, thisYear } from "./format";
import { clients, type Valuation } from "./household";
import { medianReal, type Plan } from "./montecarlo";
import { COLLEGE_INFLATION, ESTATE, LIVING_COST_ASSUMPTION, TUITION, type CollegeType } from "./reference";
import type { Household } from "./types";

/**
 * Retirement readiness at the median real return: projected assets at retirement against the lump sum needed to fund
 * every later withdrawal (present value at the same return).
 */
export function retirementGap(h: Household, plan: Plan) {
  const r = medianReal(plan), start = plan.start, retire = plan.retireYear;
  const n = Math.max(0, retire - start);
  let w = plan.wealth;
  for (let y = start; y < retire; y++) w = (w + sum(plan.flows.filter((f) => f.year === y).map((f) => f.amount))) * (1 + r);
  const after = plan.flows.filter((f) => f.year >= retire && f.amount < 0);
  const required = sum(after.map((f) => -f.amount / (1 + r) ** (f.year - retire)));
  const gap = w - required;
  // Extra savings a year (today's dollars) that would close a shortfall by retirement. Savings go in at the start of
  // each year and grow with it, so the shortfall is the future value of an annuity due: P · ((1 + r)ⁿ − 1) / r · (1 + r).
  const due = r !== 0 ? (((1 + r) ** n - 1) / r) * (1 + r) : n;
  const extra = gap < 0 && n > 0 ? -gap / due : 0;
  const firstYear = after.find((f) => f.label === "Retirement spending");
  return { yearsToRetire: n, projected: w, required, gap, extraSavings: extra, rate: r, withdrawalRate: firstYear && w > 0 ? -firstYear.amount / w : null };
}

/** Education goals: projected nominal cost and the level monthly saving needed to fund it by the first tuition bill. */
export function education(h: Household, v: Valuation) {
  // Median (compound) nominal return of a 60/20/20 mix after a 0.5% fee; arithmetic means overstate compound growth.
  const s = portfolioStats({ us: 0.6, intl: 0.2, bonds: 0.2, realestate: 0, alts: 0, cash: 0 }), m = s.mean - 0.005;
  const r = (1 + m) / Math.sqrt(1 + (s.vol / (1 + m)) ** 2) - 1;
  const saved529 = sum(v.accounts.filter((a) => h.entities.find((e) => e.id === a.entity)?.type === "529").map((a) => a.value));
  const goals = h.goals.filter((g) => g.type === "education");
  return goals.map((g) => {
    const yearsTo = Math.max(0, g.year - thisYear());
    const years = g.years ?? 4;
    const nominal = sum(Array.from({ length: years }, (_, k) => g.amount * (1 + COLLEGE_INFLATION) ** (yearsTo + k)));
    const pvAtStart = sum(Array.from({ length: years }, (_, k) => g.amount * (1 + COLLEGE_INFLATION) ** (yearsTo + k) / (1 + r) ** k));
    const share = saved529 / goals.length;
    const fv = share * (1 + r) ** yearsTo;
    const shortfall = Math.max(0, pvAtStart - fv);
    const m = (1 + r) ** (1 / 12) - 1, months = yearsTo * 12; // monthly rate that compounds to r a year
    const monthly = shortfall > 0 && months > 0 ? (shortfall * m) / ((1 + m) ** months - 1) : 0;
    return { goal: g, yearsTo, nominal, pvAtStart, saved: share, projected: fv, funded: pvAtStart ? Math.min(1, fv / pvAtStart) : 1, monthly, returnAssumed: r };
  });
}

/** Annual cost of attendance by college type: College Board tuition and fees plus the living-cost assumption. */
export const collegeCost = (type: CollegeType) => TUITION[type] + LIVING_COST_ASSUMPTION;

/**
 * Home affordability under the 28/36 rule: housing costs up to 28% of gross income, all debt payments up to 36%.
 */
export function affordability(o: { income: number; monthlyDebts: number; rate: number; downPayment: number; taxInsRate?: number; years?: number }) {
  const gross = o.income / 12, ti = o.taxInsRate ?? 0.015, n = (o.years ?? 30) * 12, i = o.rate / 12;
  const housing = Math.min(gross * 0.28, gross * 0.36 - o.monthlyDebts);
  // Price P with loan L = P − down: payment(L) + P·ti/12 ≤ housing.
  const annuity = i > 0 ? i / (1 - (1 + i) ** -n) : 1 / n;
  let price = Math.max(0, (housing + o.downPayment * annuity) / (annuity + ti / 12));
  // If the budget doesn't even cover taxes on a home the down payment could buy outright, no loan is needed.
  if (price < o.downPayment) price = Math.max(0, (housing * 12) / ti);
  const loan = Math.max(0, price - o.downPayment);
  return { price, loan, payment: loan * annuity, taxesInsurance: (price * ti) / 12, housingBudget: housing, frontEnd: gross ? (loan * annuity + (price * ti) / 12) / gross : 0 };
}

/**
 * Estate projection. Assets inside the estate grow at the median real return until the second death; the federal
 * exclusion is doubled for married couples (portability) and held constant in real terms.
 */
export function estate(h: Household, v: Valuation, plan: Plan, o: { giftingYears?: number; donees?: number; charitable?: number; trustTransfer?: number } = {}) {
  const r = medianReal(plan);
  const people = clients(h);
  const deathYear = Math.max(...people.map((p) => Number(p.dob.slice(0, 4)) + (p.planToAge ?? 92)));
  const years = Math.max(0, deathYear - thisYear());
  const married = people.length > 1 && h.marital === "Married";
  const exclusion = ESTATE.exclusion * (married ? 2 : 1);
  const donors = married ? 2 : 1;
  // Taxable gifts already made (for example to fund an existing trust) used part of the exclusion.
  const used = h.exemptionUsed ?? 0;

  const run = (gift: number, giftYears: number, trust: number, charity: number) => {
    // A trust transfer is a taxable gift: it uses exclusion first, and gift tax at 40% is due on any excess, paid from the estate.
    const left = Math.max(0, exclusion - used);
    const giftTax = Math.max(0, trust - left) * ESTATE.rate;
    const remaining = Math.max(0, left - trust);
    // Gifts leave the estate each year and compound for the heirs outside it.
    // Existing family trusts and custodial gifts already sit outside the estate; charitable vehicles do not go to heirs.
    let inside = v.estate - trust - giftTax, outside = v.netWorth - v.estate - v.charitable + trust;
    for (let y = 0; y < years; y++) {
      const g = y < giftYears ? Math.min(gift, inside) : 0;
      inside = (inside - g) * (1 + r);
      outside = (outside + g) * (1 + r);
    }
    const toCharity = inside * charity;
    const taxable = Math.max(0, inside - toCharity - remaining);
    const tax = taxable * ESTATE.rate + giftTax;
    return { gross: inside, toCharity, taxable, tax, giftTax, toHeirs: inside - toCharity - taxable * ESTATE.rate + outside, outsideEstate: outside };
  };
  const annual = ESTATE.annualGift * donors * (o.donees ?? 0);
  const baseline = run(0, 0, 0, 0);
  const strategy = run(annual, o.giftingYears ?? 0, o.trustTransfer ?? 0, o.charitable ?? 0);
  return { deathYear, years, exclusion, used, married, rate: r, annualGift: annual, baseline, strategy, current: v.estate, excluded: v.netWorth - v.estate };
}
