// Stress scenarios. Historical ones replay real asset-class returns; hypothetical ones apply stated shocks.
import { CLASSES, CMA, type Weights } from "./cma";
import type { AssetClass } from "./types";

export type Historical = { id: string; name: string; start: string; end: string; blurb: string };

export const HISTORICAL: Historical[] = [
  { id: "dotcom", name: "Dot-com bust", start: "2000-03-24", end: "2002-10-09", blurb: "Technology valuations collapsed; the S&P 500 fell for two and a half years." },
  { id: "gfc", name: "2008 financial crisis", start: "2007-10-09", end: "2009-03-09", blurb: "Housing and credit markets failed; stocks lost more than half their value." },
  { id: "covid", name: "2020 COVID crash", start: "2020-02-19", end: "2020-03-23", blurb: "The fastest bear market on record, followed by a rapid policy-driven recovery." },
  { id: "inflation22", name: "2022 inflation shock", start: "2022-01-03", end: "2022-10-12", blurb: "Inflation and rate hikes hit stocks and bonds together, breaking the usual 60/40 hedge." },
];

export type Hypothetical = { id: string; name: string; blurb: string; shock: (bondDuration: number) => Weights };

export const HYPOTHETICAL: Hypothetical[] = [
  { id: "rates", name: "Rate shock (+2 pts)", blurb: "Yields rise two percentage points across the curve. Bond losses scale with duration.",
    shock: (d) => ({ us: -0.08, intl: -0.08, bonds: -0.02 * d, realestate: -0.15, alts: -0.03, cash: 0.01 }) },
  { id: "inflation", name: "High inflation (CPI 7%)", blurb: "A sustained inflation surprise: real assets hold up, nominal bonds and growth stocks do not.",
    shock: () => ({ us: -0.15, intl: -0.12, bonds: -0.1, realestate: -0.08, alts: 0.12, cash: 0.02 }) },
  { id: "bear", name: "Equity bear market (−30%)", blurb: "A recession-driven equity decline with a flight to quality in Treasuries.",
    shock: () => ({ us: -0.3, intl: -0.32, bonds: 0.04, realestate: -0.28, alts: 0.05, cash: 0.01 }) },
];

export const PROXIES = CLASSES.map((c) => [c, CMA[c].proxy] as [AssetClass, string]);

export type ScenarioData = {
  id: string;
  returns: Record<AssetClass, number | null>;
  /** Weekly index levels per class from the scenario start (1.0) through up to six years later, for recovery analysis. */
  path: { dates: string[]; levels: Record<AssetClass, (number | null)[]> };
  notes: string[];
};

/** Portfolio loss over the window and the number of months until it regained its starting value. */
export function replay(w: Weights, s: ScenarioData, end: string) {
  const ret = CLASSES.reduce((sum, c) => sum + (w[c] ?? 0) * (s.returns[c] ?? 0), 0);
  const level = s.path.dates.map((_, i) => CLASSES.reduce((sum, c) => sum + (w[c] ?? 0) * (s.path.levels[c][i] ?? 1), 0));
  let trough = 0;
  level.forEach((v, i) => { if (s.path.dates[i] <= end && v < level[trough]) trough = i; });
  const back = level.findIndex((v, i) => i > trough && v >= 1);
  const months = back > 0 ? Math.round((Date.parse(s.path.dates[back]) - Date.parse(s.path.dates[0])) / (30.44 * 864e5)) : null;
  return { ret, worst: level[trough] - 1, recoveryMonths: months, level, dates: s.path.dates };
}
