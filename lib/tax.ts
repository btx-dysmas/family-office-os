// Federal income tax, capital gains rates and Social Security benefits under 2026 rules.
import { BRACKETS, LTCG, NIIT, SSA, STANDARD_DEDUCTION } from "./reference";
import type { FilingStatus, Household, Person } from "./types";

/** Tax on ordinary taxable income (after deductions), with the marginal rate. */
export function ordinaryTax(taxable: number, filing: FilingStatus) {
  let tax = 0, lower = 0, marginal = 0.1;
  for (const [upTo, rate] of BRACKETS[filing]) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upTo) - lower) * rate;
    marginal = rate;
    lower = upTo;
  }
  return { tax, marginal: taxable > 0 ? marginal : 0 };
}

/** Federal tax on wage or IRA-withdrawal income using the standard deduction. */
export function incomeTax(gross: number, filing: FilingStatus) {
  const taxable = Math.max(0, gross - STANDARD_DEDUCTION[filing]);
  const { tax, marginal } = ordinaryTax(taxable, filing);
  return { taxable, tax, marginal, effective: gross > 0 ? tax / gross : 0 };
}

/** Rate on long-term gains and qualified dividends at a given level of taxable income, including the 3.8% NIIT. */
export function gainsRate(taxable: number, filing: FilingStatus) {
  const [zero, fifteen] = LTCG[filing];
  const base = taxable <= zero ? 0 : taxable <= fifteen ? 0.15 : 0.2;
  return base + (taxable + STANDARD_DEDUCTION[filing] > NIIT.threshold[filing] ? NIIT.rate : 0);
}

export function householdRates(h: Household) {
  const wages = h.people.reduce((s, p) => s + (p.income ?? 0), 0);
  const t = incomeTax(wages, h.filing);
  return { ordinary: t.marginal + (t.taxable + STANDARD_DEDUCTION[h.filing] > NIIT.threshold[h.filing] ? NIIT.rate : 0), gains: gainsRate(t.taxable, h.filing), effective: t.effective, wages };
}

// ── Social Security ─────────────────────────────────────────────────────────────────────────────────────────────
/** Primary insurance amount from average indexed monthly earnings (90/32/15 formula). */
export function pia(aime: number) {
  const { bend1, bend2 } = SSA;
  return 0.9 * Math.min(aime, bend1) + 0.32 * Math.max(0, Math.min(aime, bend2) - bend1) + 0.15 * Math.max(0, aime - bend2);
}

/** Benefit as a share of PIA when claiming at `age` (full retirement age 67). */
export function claimFactor(age: number) {
  const months = Math.round((age - SSA.fullRetirementAge) * 12);
  if (months >= 0) return 1 + Math.min(months, 36) * (0.08 / 12); // 8% a year of delayed credits, to age 70
  const early = -months;
  return 1 - Math.min(early, 36) * (5 / 900) - Math.max(0, early - 36) * (5 / 1200);
}

/**
 * Annual benefit in today's dollars. AIME is approximated from current earnings, capped at the taxable maximum,
 * assuming a full career at today's real wage; a non-working spouse receives the 50% spousal benefit.
 */
export function socialSecurity(p: Person, spouse?: Person) {
  const own = pia(Math.min(p.income ?? 0, SSA.wageBase) / 12);
  const spousal = spouse ? 0.5 * pia(Math.min(spouse.income ?? 0, SSA.wageBase) / 12) : 0;
  const claim = p.ssClaimAge ?? 67;
  const monthly = own >= spousal ? own * claimFactor(claim) : spousal * Math.min(1, claimFactor(claim));
  return { pia: own, monthly, annual: monthly * 12, claimAge: claim };
}
