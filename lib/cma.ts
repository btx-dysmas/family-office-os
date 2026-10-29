// Capital market assumptions and security classification.
import type { AssetClass, RiskProfile } from "./types";

export const CLASSES: AssetClass[] = ["us", "intl", "bonds", "realestate", "alts", "cash"];

export const CLASS_LABEL: Record<AssetClass, string> = {
  us: "U.S. stocks", intl: "International stocks", bonds: "Bonds", realestate: "Real estate", alts: "Alternatives", cash: "Cash",
};
export const CLASS_COLOR: Record<AssetClass, string> = {
  us: "#6f9cf6", intl: "#a58bea", bonds: "#3cbfae", realestate: "#d9a94a", alts: "#e0708f", cash: "#7e8aa3",
};

/**
 * Long-run nominal assumptions: arithmetic mean return and volatility per year. They are round numbers in the range of
 * published 10-year capital market assumptions from large asset managers, and every model in the app reads them from here.
 */
export const CMA: Record<AssetClass, { mean: number; vol: number; yield: number; proxy: string; model: string }> = {
  us: { mean: 0.075, vol: 0.16, yield: 0.013, proxy: "VFINX", model: "VTI" },
  intl: { mean: 0.08, vol: 0.175, yield: 0.028, proxy: "VGTSX", model: "VXUS" },
  bonds: { mean: 0.045, vol: 0.055, yield: 0.042, proxy: "VBMFX", model: "BND" },
  realestate: { mean: 0.07, vol: 0.19, yield: 0.038, proxy: "VGSIX", model: "VNQ" },
  alts: { mean: 0.06, vol: 0.15, yield: 0, proxy: "GC=F", model: "GLD" },
  cash: { mean: 0.035, vol: 0.008, yield: 0.037, proxy: "VFISX", model: "SGOV" },
};
export const INFLATION = 0.025;

// Correlations, same order as CLASSES.
export const CORR: number[][] = [
  [1.0, 0.85, 0.1, 0.7, 0.1, 0.0],
  [0.85, 1.0, 0.1, 0.65, 0.2, 0.0],
  [0.1, 0.1, 1.0, 0.25, 0.25, 0.15],
  [0.7, 0.65, 0.25, 1.0, 0.15, 0.0],
  [0.1, 0.2, 0.25, 0.15, 1.0, 0.05],
  [0.0, 0.0, 0.15, 0.0, 0.05, 1.0],
];

export type Weights = Record<AssetClass, number>;
export const zeroWeights = (): Weights => ({ us: 0, intl: 0, bonds: 0, realestate: 0, alts: 0, cash: 0 });

/** Expected return and volatility of a mix: mean = Σ wᵢμᵢ, variance = wᵀΣw with Σᵢⱼ = ρᵢⱼσᵢσⱼ. */
export function portfolioStats(w: Weights) {
  const v = CLASSES.map((c) => w[c] ?? 0);
  const mean = CLASSES.reduce((s, c, i) => s + v[i] * CMA[c].mean, 0);
  let variance = 0;
  CLASSES.forEach((a, i) => CLASSES.forEach((b, j) => (variance += v[i] * v[j] * CORR[i][j] * CMA[a].vol * CMA[b].vol)));
  return { mean, vol: Math.sqrt(variance) };
}

/** Median (compound) annual return of a lognormal with arithmetic mean `mean` and volatility `vol`. */
export const compound = (mean: number, vol: number) => (1 + mean) / Math.sqrt(1 + (vol / (1 + mean)) ** 2) - 1;

/** Each class's share of portfolio variance: wᵢ(Σw)ᵢ / wᵀΣw. */
export function riskContribution(w: Weights) {
  const v = CLASSES.map((c) => w[c] ?? 0);
  const sw = CLASSES.map((a, i) => CLASSES.reduce((s, b, j) => s + CORR[i][j] * CMA[a].vol * CMA[b].vol * v[j], 0));
  const total = v.reduce((s, x, i) => s + x * sw[i], 0) || 1;
  return Object.fromEntries(CLASSES.map((c, i) => [c, (v[i] * sw[i]) / total])) as Weights;
}

// ── Security classification ──────────────────────────────────────────────────────────────────────────────────────
const FUND_CLASS: Record<string, AssetClass> = {};
const add = (cls: AssetClass, list: string) => list.split(/\s+/).filter(Boolean).forEach((s) => (FUND_CLASS[s] = cls));
add("us", "VOO VTI IVV SPY SCHD QQQ VUG VTV IWM SCHB ITOT VIG DGRO SCHG MGK RSP DIA VXF IJH IJR VOOG VYM XLK XLF XLV XLE");
add("intl", "VXUS VEA VWO IEFA EFA IXUS SCHF IEMG VEU EEM ACWX");
add("bonds", "BND AGG VGIT VGSH VGLT TLT IEF SHY MUB VTEB TIP SCHP LQD VCIT BNDX SCHZ IUSB HYG JNK BSV VCSH GOVT");
add("realestate", "VNQ SCHH VNQI IYR XLRE");
add("alts", "GLD IAU SLV DBC PDBC GSG BTAL KMLM DBMF");
add("cash", "SGOV BIL SHV USFR VMFXX SPAXX $CASH");

export const classify = (symbol: string): AssetClass => FUND_CLASS[symbol] ?? "us";
export const isFund = (symbol: string) => symbol in FUND_CLASS;

/** Sub-asset class for the allocation drill-down. Single stocks are grouped separately from funds. */
const SUB: Record<string, string> = {};
const sub = (label: string, list: string) => list.split(/\s+/).filter(Boolean).forEach((x) => (SUB[x] = label));
sub("Total market", "VTI ITOT SCHB");
sub("Large-cap blend", "VOO IVV SPY RSP DIA");
sub("Large-cap growth", "VUG QQQ SCHG MGK VOOG XLK");
sub("Dividend and value", "SCHD VTV VYM VIG DGRO");
sub("Small and mid cap", "IWM IJR IJH VXF");
sub("Sector funds", "XLF XLV XLE");
sub("Developed markets", "VEA IEFA EFA SCHF");
sub("Emerging markets", "VWO IEMG EEM");
sub("Total international", "VXUS IXUS VEU ACWX");
sub("Core aggregate", "BND AGG SCHZ IUSB");
sub("Municipal", "VTEB MUB");
sub("Inflation-protected", "TIP SCHP");
sub("Treasuries", "VGIT IEF GOVT VGSH SHY BSV");
sub("Long Treasuries", "TLT VGLT");
sub("Corporate", "LQD VCIT VCSH");
sub("High yield", "HYG JNK");
sub("International bonds", "BNDX");
sub("REITs", "VNQ SCHH IYR XLRE");
sub("International REITs", "VNQI");
sub("Precious metals", "GLD IAU SLV");
sub("Commodities", "DBC PDBC GSG");
sub("Managed futures and hedges", "BTAL KMLM DBMF");
sub("T-bills", "SGOV BIL SHV USFR");
sub("Bank deposits and money market", "$CASH VMFXX SPAXX");
export const subclass = (symbol: string) => SUB[symbol] ?? (symbol in FUND_CLASS ? "Other funds" : "Single stocks");

/** Approximate effective duration of common bond funds (years); used for interest-rate sensitivity. */
export const DURATION: Record<string, number> = {
  BND: 5.8, AGG: 5.9, VGIT: 5.0, VGSH: 1.9, VGLT: 13.5, TLT: 16.5, IEF: 7.0, SHY: 1.9, MUB: 6.0, VTEB: 6.0, TIP: 6.5, SCHP: 6.5,
  LQD: 8.2, VCIT: 6.0, BNDX: 7.0, SCHZ: 5.9, IUSB: 5.9, HYG: 3.2, JNK: 3.2, BSV: 2.6, VCSH: 2.6, GOVT: 5.8,
};

/** Similar-but-not-identical replacements for tax-loss harvesting (avoids the wash-sale rule on the sold fund). */
export const HARVEST_PAIR: Record<string, string> = {
  VTI: "ITOT", ITOT: "VTI", VOO: "IVV", IVV: "VOO", SPY: "VOO", VXUS: "IXUS", IXUS: "VXUS", VEA: "IEFA", IEFA: "VEA", VWO: "IEMG",
  IEMG: "VWO", BND: "AGG", AGG: "BND", VNQ: "SCHH", SCHH: "VNQ", QQQ: "VUG", VUG: "SCHG", SCHD: "VYM", VYM: "SCHD", TLT: "VGLT",
  VGLT: "TLT", MUB: "VTEB", VTEB: "MUB", IEF: "VGIT", VGIT: "IEF", TIP: "SCHP", SCHP: "TIP", LQD: "VCIT", VCIT: "LQD",
};

/** Strategic allocations by risk profile, the starting point for an investment policy. */
export const MODEL: Record<RiskProfile, Weights> = {
  Conservative: { us: 0.2, intl: 0.1, bonds: 0.5, realestate: 0.05, alts: 0.05, cash: 0.1 },
  Moderate: { us: 0.35, intl: 0.15, bonds: 0.35, realestate: 0.05, alts: 0.05, cash: 0.05 },
  Aggressive: { us: 0.5, intl: 0.2, bonds: 0.15, realestate: 0.05, alts: 0.07, cash: 0.03 },
};

/** Rebalancing band: ±5 points for large sleeves, ±3 for small ones. */
export const band = (target: number) => (target >= 0.15 ? 0.05 : 0.03);
