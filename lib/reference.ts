// Published reference figures. These change once a year; update them here and every calculation follows.
import type { FilingStatus } from "./types";

export const TAX_YEAR = 2026;

type Bracket = [upTo: number, rate: number];

/** Federal ordinary income brackets, 2026 (IRS, Rev. Proc. 2025-32). */
export const BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [[12_400, 0.1], [50_400, 0.12], [105_700, 0.22], [201_775, 0.24], [256_225, 0.32], [640_600, 0.35], [Infinity, 0.37]],
  mfj: [[24_800, 0.1], [100_800, 0.12], [211_400, 0.22], [403_550, 0.24], [512_450, 0.32], [768_700, 0.35], [Infinity, 0.37]],
  // Head of household uses the single schedule above the 24% bracket; lower brackets are wider.
  hoh: [[17_700, 0.1], [67_450, 0.12], [105_700, 0.22], [201_775, 0.24], [256_200, 0.32], [640_600, 0.35], [Infinity, 0.37]],
};

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = { single: 16_100, mfj: 32_200, hoh: 24_150 };

/** Long-term capital gains and qualified dividends: top of the 0% and 15% brackets, by taxable income. */
export const LTCG: Record<FilingStatus, [zeroTo: number, fifteenTo: number]> = {
  single: [49_450, 545_500],
  mfj: [98_900, 613_700],
  hoh: [66_200, 579_600],
};

/** Net investment income tax: 3.8% above these modified AGI thresholds (not indexed). */
export const NIIT = { rate: 0.038, threshold: { single: 200_000, mfj: 250_000, hoh: 200_000 } as Record<FilingStatus, number> };

/** Retirement plan limits, 2026 (IRS Notice 2025-67). */
export const LIMITS = { k401: 24_500, k401CatchUp: 8_000, k401CatchUp60to63: 11_250, ira: 7_500, iraCatchUp: 1_100 };

/** Estate and gift tax, 2026. The basic exclusion is $15M per person and is indexed for inflation from 2027. */
export const ESTATE = { exclusion: 15_000_000, annualGift: 19_000, rate: 0.4 };

/** Social Security, 2026 (SSA). PIA = 90% of AIME up to the first bend point, 32% to the second, 15% above. */
export const SSA = { bend1: 1_286, bend2: 7_749, wageBase: 184_500, cola: 0.028, fullRetirementAge: 67 };

/** Average published tuition and fees, 2025-26 (College Board, Trends in College Pricing 2025). */
export const TUITION = { "Public in-state": 11_950, "Public out-of-state": 31_880, "Private nonprofit": 45_000 } as const;
export type CollegeType = keyof typeof TUITION;
/** Housing, food, books and other costs are an editable planning assumption, not a published average. */
export const LIVING_COST_ASSUMPTION = 17_000;
export const COLLEGE_INFLATION = 0.035; // nominal, planning assumption

/** Required minimum distributions begin at 73, or 75 for anyone born in 1960 or later (SECURE 2.0). */
export const rmdAge = (birthYear: number) => (birthYear >= 1960 ? 75 : 73);

/** IRS Uniform Lifetime Table (excerpt): distribution period by age. */
export const UNIFORM_LIFETIME: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
  86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
};

export const SOURCES = [
  { name: "IRS Rev. Proc. 2025-32", what: "2026 tax brackets, standard deduction, gift exclusion, estate exclusion", url: "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill" },
  { name: "IRS Notice 2025-67", what: "2026 401(k) and IRA contribution limits", url: "https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500" },
  { name: "Social Security Administration", what: "2026 bend points, taxable maximum, COLA", url: "https://www.ssa.gov/news/en/cola/factsheets/2026.html" },
  { name: "College Board, Trends in College Pricing 2025", what: "2025-26 average published tuition and fees", url: "https://research.collegeboard.org/trends/college-pricing/highlights" },
  { name: "FRED, Federal Reserve Bank of St. Louis", what: "Inflation, growth, unemployment, rates, mortgage rates, credit spreads", url: "https://fred.stlouisfed.org" },
  { name: "U.S. Department of the Treasury", what: "Daily par yield curve", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates" },
  { name: "SEC EDGAR, Form N-PORT", what: "Complete fund holdings for look-through analysis", url: "https://www.sec.gov/dera/data/form-n-port-data-sets" },
  { name: "Yahoo Finance", what: "Prices, fund expense ratios, sector weights, trailing returns", url: "https://finance.yahoo.com" },
];
