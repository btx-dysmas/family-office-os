// Federal income tax, capital gains rates and Social Security benefits under 2026 rules.
import { BRACKETS, LTCG, NIIT, SENIOR, SS_TAX_THRESHOLDS, SSA, STANDARD_DEDUCTION } from "./reference";
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
  return base + (taxable + STANDARD_DEDUCTION[filing] > NIIT.threshold[filing] ? NIIT.rate : 0); // MAGI ≈ taxable income + standard deduction
}

/**
 * Federal tax on a long-term gain stacked on top of ordinary taxable income: the gain fills the 0%, 15% and 20% brackets
 * in turn, and the 3.8% NIIT applies to the part of the gain that lifts income above the threshold.
 */
export function gainsTax(gain: number, ordinaryTaxable: number, filing: FilingStatus, magi?: number) {
  if (gain <= 0) return 0;
  const [zero, fifteen] = LTCG[filing], top = ordinaryTaxable + gain;
  const at15 = Math.max(0, Math.min(top, fifteen) - Math.max(ordinaryTaxable, zero));
  const at20 = Math.max(0, top - Math.max(ordinaryTaxable, fifteen));
  magi ??= top + STANDARD_DEDUCTION[filing];
  const niit = Math.min(gain, Math.max(0, magi - NIIT.threshold[filing])) * NIIT.rate;
  return 0.15 * at15 + 0.2 * at20 + niit;
}

export function householdRates(h: Household) {
  const wages = h.people.reduce((s, p) => s + (p.income ?? 0), 0);
  const t = incomeTax(wages, h.filing);
  const niit = wages > NIIT.threshold[h.filing] ? NIIT.rate : 0;
  // Investment income on top of wages: ordinary rate for interest, preferential rate for gains, 28% cap for collectibles.
  return { ordinary: t.marginal + niit, gains: gainsRate(t.taxable, h.filing), collectibles: Math.min(0.28, t.marginal) + niit, niit, effective: t.effective, wages };
}

// ── Social Security ─────────────────────────────────────────────────────────────────────────────────────────────
/** Primary insurance amount from average indexed monthly earnings (90/32/15 formula). */
export function pia(aime: number) {
  const { bend1, bend2 } = SSA;
  return 0.9 * Math.min(aime, bend1) + 0.32 * Math.max(0, Math.min(aime, bend2) - bend1) + 0.15 * Math.max(0, aime - bend2);
}

/** Full retirement age by birth year: 66 through 1954, two months later for each year to 67 for 1960 and after. */
export function fullRetirementAge(birthYear: number) {
  if (birthYear <= 1954) return 66;
  if (birthYear >= 1960) return SSA.fullRetirementAge;
  return 66 + ((birthYear - 1954) * 2) / 12;
}

/** Worker's benefit as a share of PIA when claiming at `age`: 5/9% a month for the first 36 months early, 5/12% after, 2/3% a month delayed to 70. */
export function claimFactor(age: number, fra: number = SSA.fullRetirementAge) {
  const months = Math.round((Math.min(age, 70) - fra) * 12);
  if (months >= 0) return 1 + months * (0.08 / 12);
  const early = -months;
  return 1 - Math.min(early, 36) * (5 / 900) - Math.max(0, early - 36) * (5 / 1200);
}

/** Spousal benefit as a share of the full 50% amount: 25/36% a month for the first 36 months early, 5/12% after, no delayed credits. */
export function spousalFactor(age: number, fra: number = SSA.fullRetirementAge) {
  const early = Math.max(0, Math.round((fra - age) * 12));
  return 1 - Math.min(early, 36) * (25 / 3600) - Math.max(0, early - 36) * (5 / 1200);
}

/**
 * Annual benefit in today's dollars. AIME is approximated from current earnings, capped at the taxable maximum,
 * assuming a full career at today's real wage. A spouse with a lower PIA receives their own benefit plus the excess of
 * half the worker's PIA over it, each reduced for the claiming age.
 */
export function socialSecurity(p: Person, spouse?: Person) {
  const fra = fullRetirementAge(Number(p.dob.slice(0, 4)));
  const own = pia(Math.min(p.income ?? 0, SSA.wageBase) / 12);
  const half = spouse ? 0.5 * pia(Math.min(spouse.income ?? 0, SSA.wageBase) / 12) : 0;
  const claim = p.ssClaimAge ?? 67;
  const monthly = own * claimFactor(claim, fra) + Math.max(0, half - own) * spousalFactor(claim, fra);
  return { pia: own, monthly, annual: monthly * 12, claimAge: claim, fra, factor: monthly / (own || half || 1) };
}

/** Taxable part of Social Security benefits from provisional income (other income plus half the benefit); at most 85%. */
export function taxableBenefits(benefits: number, otherIncome: number, filing: FilingStatus) {
  const [base, adjusted] = SS_TAX_THRESHOLDS[filing];
  const provisional = otherIncome + benefits / 2;
  if (provisional <= base) return 0;
  if (provisional <= adjusted) return Math.min(benefits / 2, (provisional - base) / 2);
  return Math.min(0.85 * benefits, 0.85 * (provisional - adjusted) + Math.min(benefits / 2, (adjusted - base) / 2));
}

/** Standard deduction including the additional amount and the 2025–2028 senior deduction for each person 65 or older. */
export function deduction(filing: FilingStatus, seniors: number, magi: number, year: number) {
  const bonusYears = year >= SENIOR.bonusFrom && year <= SENIOR.bonusTo;
  const bonus = bonusYears ? Math.max(0, SENIOR.bonus - SENIOR.bonusRate * Math.max(0, magi - SENIOR.bonusThreshold[filing])) : 0;
  return STANDARD_DEDUCTION[filing] + seniors * (SENIOR.additional[filing] + bonus);
}

/** Where a retirement withdrawal comes from, pro rata across the household's accounts. */
export type WithdrawalMix = { deferred: number; gains: number }; // share taxed as ordinary income; share that is long-term gain

export type TaxYear = { filing: FilingStatus; seniors: number; year: number; mix: WithdrawalMix; rmd?: number };

/** Federal tax for a retirement year: withdrawals split into ordinary income and gains, Social Security, other income. */
export function retirementTax(w: number, benefits: number, otherIncome: number, t: TaxYear) {
  // A required minimum distribution larger than the pro-rata draw is taxed in full; the excess is reinvested.
  const ordinary = otherIncome + Math.max(t.mix.deferred * w, t.rmd ?? 0), gains = t.mix.gains * w;
  const taxableSS = taxableBenefits(benefits, ordinary + gains, t.filing);
  const agi = ordinary + gains + taxableSS;
  const taxable = Math.max(0, agi - deduction(t.filing, t.seniors, agi, t.year));
  // Deductions offset ordinary income first; gains sit on top of it in the capital gains brackets.
  const gainPart = Math.min(gains, taxable), ordPart = taxable - gainPart;
  return ordinaryTax(ordPart, t.filing).tax + gainsTax(gainPart, ordPart, t.filing, agi);
}

/**
 * Portfolio withdrawal that leaves `spending` after federal tax, given Social Security and other taxable income.
 * Only the tax-deferred share of a withdrawal is ordinary income and only the embedded gain in the taxable share is
 * taxed (Roth withdrawals and cost basis are tax-free). Solved by bisection.
 */
export function grossWithdrawal(spending: number, benefits: number, otherIncome: number, t: TaxYear) {
  const net = (w: number) => w + otherIncome + benefits - retirementTax(w, benefits, otherIncome, t);
  if (net(0) >= spending) return 0;
  let lo = 0, hi = spending * 2 + 1;
  while (net(hi) < spending) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (net(mid) < spending) lo = mid; else hi = mid;
  }
  return hi;
}
