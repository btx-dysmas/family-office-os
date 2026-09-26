// Economic regime classification and the rules-based investment committee view.
type Obs = [string, number][];
type Series = Record<string, { obs?: Obs; latest?: [string, number] | null; chg1y?: number | null }>;

export type Regime = "Expansion" | "Recovery" | "Late cycle" | "Recession" | "Stagflation";

export const REGIME_COLOR: Record<Regime, string> = {
  Expansion: "#3cbfae", Recovery: "#6f9cf6", "Late cycle": "#7e8aa3", Recession: "#e0708f", Stagflation: "#d9a94a",
};

export const IMPLICATIONS: Record<Regime, { summary: string; equities: string; bonds: string; real: string; cash: string }> = {
  Expansion: {
    summary: "Growth is above trend and inflation is contained. Earnings rise and credit is easy to get.",
    equities: "Favor stocks, including cyclical and small-cap companies.", bonds: "Keep duration short; yields tend to drift up.",
    real: "Neutral; commodities firm with demand.", cash: "Keep cash light; the opportunity cost is high.",
  },
  Recovery: {
    summary: "Growth has turned positive while unemployment is high but falling. Policy is usually supportive.",
    equities: "Favor stocks; small caps and value usually lead early in a cycle.", bonds: "Neutral; credit spreads tighten, so corporates beat Treasuries.",
    real: "Neutral to positive for real estate as rates stabilize.", cash: "Keep cash light.",
  },
  "Late cycle": {
    summary: "Growth is below trend without an outright contraction. Margins come under pressure and leadership narrows.",
    equities: "Neutral; rotate toward quality balance sheets and stable earnings.", bonds: "Add duration as rate expectations fall.",
    real: "Trim cyclical commodities.", cash: "Neutral.",
  },
  Recession: {
    summary: "Output is contracting or unemployment is rising fast. Earnings estimates fall and defaults rise.",
    equities: "Underweight; favor defensive sectors and low leverage.", bonds: "Overweight high-quality duration; Treasuries rally as rates are cut.",
    real: "Underweight commodities; gold can hold up.", cash: "Overweight for liquidity and to rebalance into weakness.",
  },
  Stagflation: {
    summary: "Weak growth with inflation above target. Stocks and nominal bonds tend to struggle together.",
    equities: "Underweight; favor pricing power.", bonds: "Underweight nominal duration; prefer TIPS and short maturities.",
    real: "Overweight commodities, energy and gold.", cash: "Neutral to overweight; short rates are usually high.",
  },
};

const lastBefore = (obs: Obs | undefined, date: string) => {
  let v: number | null = null;
  for (const [d, x] of obs ?? []) { if (d > date) break; v = x; }
  return v;
};
const between = (obs: Obs | undefined, from: string, to: string) => (obs ?? []).filter(([d]) => d > from && d <= to).map(([, v]) => v);
const shift = (date: string, months: number) => { const t = new Date(date); t.setUTCMonth(t.getUTCMonth() + months); return t.toISOString().slice(0, 10); };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type Reading = { date: string; regime: Regime; gdp: number | null; cpi: number | null; unemp: number | null; sahm: number | null; curve: number | null; reasons: string[] };

/** Classify the regime as of `date` using only data published by then. */
export function classify(series: Series, date: string): Reading {
  const gdp = lastBefore(series.A191RL1Q225SBEA?.obs, date), cpi = lastBefore(series.CPIAUCSL?.obs, date), unemp = lastBefore(series.UNRATE?.obs, date);
  const curve = lastBefore(series.T10Y2Y?.obs, date), u = series.UNRATE?.obs;
  // Sahm rule: three-month average unemployment against its low over the prior twelve months.
  const u3 = avg(between(u, shift(date, -3), date)), low12 = Math.min(...between(u, shift(date, -15), shift(date, -3)));
  const sahm = u3 != null && isFinite(low12) ? u3 - low12 : null;
  const u3prior = avg(between(u, shift(date, -9), shift(date, -6)));
  const falling = u3 != null && u3prior != null && u3 < u3prior;
  const low24 = Math.min(...between(u, shift(date, -24), date));
  const reasons: string[] = [];
  let regime: Regime;
  if (cpi != null && cpi > 3.5 && ((gdp != null && gdp < 1) || (sahm != null && sahm >= 0.3))) {
    regime = "Stagflation";
    reasons.push(`CPI inflation of ${cpi.toFixed(1)}% alongside weak growth`);
  } else if ((sahm != null && sahm >= 0.5) || (gdp != null && gdp < 0)) {
    regime = "Recession";
    if (gdp != null && gdp < 0) reasons.push(`real GDP contracting at ${gdp.toFixed(1)}% annualized`);
    if (sahm != null && sahm >= 0.5) reasons.push(`Sahm rule triggered: unemployment ${sahm.toFixed(2)} pts above its 12-month low`);
  } else if (gdp != null && gdp > 0 && unemp != null && isFinite(low24) && unemp - low24 >= 0.5 && falling) {
    regime = "Recovery";
    reasons.push(`growth positive while unemployment (${unemp.toFixed(1)}%) is above its two-year low but falling`);
  } else if (gdp != null && gdp >= 1.5) {
    regime = "Expansion";
    reasons.push(`real GDP growing ${gdp.toFixed(1)}% annualized`);
    if (cpi != null && cpi > 3) reasons.push(`inflation elevated at ${cpi.toFixed(1)}%`);
  } else {
    regime = "Late cycle";
    reasons.push(`real GDP growth of ${gdp?.toFixed(1) ?? "n/a"}% is below trend`);
  }
  if (curve != null && curve < 0) reasons.push(`yield curve inverted (10y less 2y at ${curve.toFixed(2)} pts)`);
  return { date, regime, gdp, cpi, unemp, sahm, curve, reasons };
}

export function history(series: Series, from = "2008-03-31"): Reading[] {
  const out: Reading[] = [];
  const now = new Date().toISOString().slice(0, 10);
  for (let d = from; d <= now; d = shift(d, 3)) out.push(classify(series, d));
  return out;
}

// ── Investment committee ────────────────────────────────────────────────────────────────────────────────────────
export type Sleeve = "U.S. equities" | "International equities" | "Growth vs. value" | "Duration" | "Credit" | "Real assets" | "Cash";
export type View = { sleeve: Sleeve; score: number; stance: string; reasons: string[] };

const BASE: Record<Regime, Record<Sleeve, number>> = {
  Expansion: { "U.S. equities": 1, "International equities": 1, "Growth vs. value": 0, Duration: -1, Credit: 1, "Real assets": 0, Cash: -1 },
  Recovery: { "U.S. equities": 1, "International equities": 1, "Growth vs. value": -1, Duration: 0, Credit: 1, "Real assets": 0, Cash: -1 },
  "Late cycle": { "U.S. equities": 0, "International equities": 0, "Growth vs. value": 0, Duration: 1, Credit: -1, "Real assets": 0, Cash: 0 },
  Recession: { "U.S. equities": -1, "International equities": -1, "Growth vs. value": 0, Duration: 2, Credit: -1, "Real assets": -1, Cash: 1 },
  Stagflation: { "U.S. equities": -1, "International equities": -1, "Growth vs. value": -1, Duration: -1, Credit: -1, "Real assets": 2, Cash: 1 },
};

const STANCE = (s: number, sleeve: Sleeve) =>
  sleeve === "Growth vs. value"
    ? s <= -1 ? "Favor value" : s >= 1 ? "Favor growth" : "Balanced"
    : s <= -2 ? "Underweight" : s === -1 ? "Modest underweight" : s === 0 ? "Neutral" : s === 1 ? "Modest overweight" : "Overweight";

export function committee(reading: Reading, series: Series, market: { pe?: number | null; last?: number; ma200?: number } | null) {
  const score = { ...BASE[reading.regime] };
  const why: Record<Sleeve, string[]> = Object.fromEntries(Object.keys(score).map((k) => [k, [`${reading.regime} regime baseline`]])) as Record<Sleeve, string[]>;
  const tilt = (s: Sleeve, d: number, reason: string) => { score[s] += d; why[s].push(reason); };

  if (reading.curve != null && reading.curve < 0) tilt("U.S. equities", -1, `Yield curve inverted at ${reading.curve.toFixed(2)} pts`);
  if (market?.pe != null && market.pe > 22) { tilt("U.S. equities", -1, `S&P 500 trailing P/E of ${market.pe.toFixed(1)} is well above its long-run average`); tilt("Growth vs. value", -1, "Valuation expansion concentrated in growth stocks"); }
  if (market?.pe != null && market.pe < 16) tilt("U.S. equities", 1, `S&P 500 trailing P/E of ${market.pe.toFixed(1)} is below average`);
  if (market?.last && market?.ma200) {
    if (market.last < market.ma200) tilt("U.S. equities", -1, "S&P 500 below its 200-day moving average");
    else why["U.S. equities"].push("S&P 500 above its 200-day moving average (trend intact)");
  }
  const cpi = series.CPIAUCSL?.latest?.[1], cpiChg = series.CPIAUCSL?.chg1y;
  if (cpi != null && cpi > 3 && (cpiChg ?? 0) >= 0) { tilt("Duration", -1, `Inflation persistence: CPI at ${cpi.toFixed(1)}% and not falling`); tilt("Real assets", 1, "Real assets hedge persistent inflation"); }
  const ten = series.DGS10?.latest?.[1];
  if (ten != null && cpi != null && ten - cpi > 1.5) tilt("Duration", 1, `Real 10-year yield near ${(ten - cpi).toFixed(1)}% offers value`);
  const spread = series.BAA10Y?.latest?.[1];
  if (spread != null && spread > 2.5) tilt("Credit", -1, `Credit spreads wide at ${spread.toFixed(2)} pts, a sign of stress`);
  if (spread != null && spread < 1.8) tilt("Credit", -1, `Credit spreads tight at ${spread.toFixed(2)} pts: little cushion for defaults`);
  const vix = series.VIXCLS?.latest?.[1];
  if (vix != null && vix > 25) tilt("Cash", 1, `VIX at ${vix.toFixed(0)}: hold dry powder`);
  const tbill = series.DTB3?.latest?.[1];
  if (tbill != null && cpi != null && tbill > cpi) why.Cash.push(`T-bills at ${tbill.toFixed(2)}% pay more than inflation`);

  const views: View[] = (Object.keys(score) as Sleeve[]).map((s) => {
    const v = Math.max(-2, Math.min(2, score[s]));
    return { sleeve: s, score: v, stance: STANCE(v, s), reasons: why[s] };
  });
  return { regime: reading.regime, views, date: reading.date };
}
