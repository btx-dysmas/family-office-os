// Historical analytics for the current portfolio: its holdings at today's weights, rebalanced daily, over the chosen window.
import { classify } from "./cma";
import { sum } from "./format";
import type { Valuation } from "./household";
import type { AssetClass } from "./types";

export type Prices = { dates: string[]; bench: (number | null)[]; series: Record<string, (number | null)[]> };

const mean = (a: number[]) => sum(a) / (a.length || 1);
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / Math.max(1, a.length - 1)); };
const cov = (a: number[], b: number[]) => { const ma = mean(a), mb = mean(b); return sum(a.map((x, i) => (x - ma) * (b[i] - mb))) / Math.max(1, a.length - 1); };

export function analyze(v: Valuation, prices: Prices, days: number, rf: number) {
  // Weights by symbol across the policy portfolio; cash earns the T-bill rate.
  const bySym = new Map<string, number>();
  v.positions.filter((p) => p.account.inPolicy).forEach((p) => bySym.set(p.symbol, (bySym.get(p.symbol) ?? 0) + p.value));
  const total = sum([...bySym.values()]) || 1;
  const holdings = [...bySym.entries()].map(([symbol, val]) => ({ symbol, weight: val / total, cls: classify(symbol) as AssetClass }))
    .filter((x) => x.symbol === "$CASH" || prices.series[x.symbol]);
  const covered = sum(holdings.map((x) => x.weight));
  if (!holdings.length) return null;

  const idx = prices.dates.map((_, i) => i).filter((i) => prices.bench[i] != null && holdings.every((x) => x.symbol === "$CASH" || prices.series[x.symbol][i] != null)).slice(-(days + 1));
  if (idx.length < 60) return null;
  const cashDaily = rf / 252;
  const rets = holdings.map((x) => idx.slice(1).map((i, k) => (x.symbol === "$CASH" ? cashDaily : (prices.series[x.symbol][i] as number) / (prices.series[x.symbol][idx[k]] as number) - 1)));
  const bench = idx.slice(1).map((i, k) => (prices.bench[i] as number) / (prices.bench[idx[k]] as number) - 1);
  const w = holdings.map((x) => x.weight / covered);
  const port = bench.map((_, t) => sum(rets.map((r, j) => w[j] * r[t])));
  const years = port.length / 252;

  const grow = (r: number[]) => { const g = [1]; for (const x of r) g.push(g[g.length - 1] * (1 + x)); return g; };
  const dd = (g: number[]) => { let pk = -Infinity; return g.map((x) => { pk = Math.max(pk, x); return x / pk - 1; }); };
  const stats = (r: number[]) => {
    const g = grow(r), cagr = g[g.length - 1] ** (1 / years) - 1, vol = sd(r) * Math.sqrt(252);
    const downside = Math.sqrt(sum(r.map((x) => Math.min(0, x - rf / 252) ** 2)) / r.length) * Math.sqrt(252);
    return { total: g[g.length - 1] - 1, cagr, vol, downside, sharpe: (cagr - rf) / vol, sortino: (cagr - rf) / downside, maxDD: Math.min(...dd(g)), growth: g };
  };
  const P = stats(port), B = stats(bench);
  const varP = cov(port, port), varB = cov(bench, bench);

  // Rolling 12-month returns, sampled weekly.
  const rolling: { date: string; port: number; bench: number }[] = [];
  for (let t = 252; t < P.growth.length; t += 5) rolling.push({ date: prices.dates[idx[t]], port: P.growth[t] / P.growth[t - 252] - 1, bench: B.growth[t] / B.growth[t - 252] - 1 });

  const contributions = holdings.map((x, j) => {
    const s = stats(rets[j]);
    return { ...x, weight: w[j], cagr: s.cagr, vol: s.vol, contribution: w[j] * s.cagr, risk: (w[j] * cov(rets[j], port)) / varP, beta: cov(rets[j], bench) / varB };
  }).sort((a, b) => b.weight - a.weight);

  return {
    dates: idx.map((i) => prices.dates[i]), port: { ...P, beta: cov(port, bench) / varB, drawdown: dd(P.growth) }, bench: { ...B, drawdown: dd(B.growth) },
    rolling, contributions, covered, years,
  };
}
export type Analysis = NonNullable<ReturnType<typeof analyze>>;
