// The investment policy statement as executable rules: compliance checks, rebalancing trades, asset location and
// tax-loss harvesting all read their limits and targets from the household's IPS.
import { CLASS_LABEL, CLASSES, CMA, HARVEST_PAIR, isFund, portfolioStats } from "./cma";
import { daysUntil, pct, sum } from "./format";
import { drift, type Valuation } from "./household";
import { householdRates } from "./tax";
import type { AssetClass, Household, TaxTreatment } from "./types";

export type Status = "Compliant" | "Watch" | "Breach";
export type Check = { area: string; rule: string; actual: string; status: Status; detail?: string };

/** Evaluate every IPS constraint against the live portfolio. `stressLoss` is the worst historical scenario loss, if known. */
export function compliance(h: Household, v: Valuation, stressLoss?: number | null): Check[] {
  const L = h.ips.limits, w = v.policyWeights, stats = portfolioStats(w);
  const out: Check[] = [];
  for (const d of drift(h, w)) {
    if (!d.target && !d.current) continue;
    const near = !d.breach && (d.current - d.min < 0.01 || d.max - d.current < 0.01);
    out.push({ area: "Allocation", rule: `${CLASS_LABEL[d.cls]} ${pct(d.min, 0)}–${pct(d.max, 0)} (target ${pct(d.target, 0)})`, actual: pct(d.current), status: d.breach ? "Breach" : near ? "Watch" : "Compliant" });
  }
  out.push({ area: "Risk", rule: `Expected volatility at most ${pct(L.maxVolatility, 0)}`, actual: pct(stats.vol), status: stats.vol > L.maxVolatility ? "Breach" : stats.vol > L.maxVolatility * 0.95 ? "Watch" : "Compliant" });
  if (stressLoss != null)
    out.push({ area: "Risk", rule: `Loss in the worst historical stress no deeper than ${pct(L.maxDrawdown, 0)}`, actual: pct(stressLoss), status: -stressLoss > L.maxDrawdown ? "Breach" : -stressLoss > L.maxDrawdown * 0.9 ? "Watch" : "Compliant" });

  const policyPositions = v.positions.filter((p) => p.account.inPolicy && p.symbol !== "$CASH" && !isFund(p.symbol));
  const bySymbol = new Map<string, number>();
  policyPositions.forEach((p) => bySymbol.set(p.symbol, (bySymbol.get(p.symbol) ?? 0) + p.value));
  const [topSym, topVal] = [...bySymbol.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const topShare = v.policy ? topVal / v.policy : 0;
  out.push({ area: "Concentration", rule: `No single security above ${pct(L.maxPosition, 0)} of the portfolio`, actual: topVal ? `${topSym} ${pct(topShare)}` : "None held", status: topShare > L.maxPosition ? "Breach" : topShare > L.maxPosition * 0.8 ? "Watch" : "Compliant", detail: "Diversified funds are exempt." });

  out.push({ area: "Liquidity", rule: `Cash reserve of at least ${h.ips.liquidityMonths} months of spending`, actual: `${v.ratios.liquidityMonths.toFixed(1)} months`, status: v.ratios.liquidityMonths < h.ips.liquidityMonths * 0.75 ? "Breach" : v.ratios.liquidityMonths < h.ips.liquidityMonths ? "Watch" : "Compliant" });
  out.push({ area: "Liquidity", rule: `Illiquid investments at most ${pct(L.maxIlliquid, 0)} of investable net worth`, actual: pct(v.ratios.illiquidShare), status: v.ratios.illiquidShare > L.maxIlliquid ? "Breach" : v.ratios.illiquidShare > L.maxIlliquid * 0.9 ? "Watch" : "Compliant" });

  const expected = stats.mean - h.ips.advisoryFee;
  out.push({ area: "Return", rule: `Expected return after fees of at least ${pct(h.ips.returnTarget)}`, actual: pct(expected), status: expected < h.ips.returnTarget - 0.005 ? "Watch" : "Compliant", detail: "A shortfall here is a planning signal, not a trading trigger." });
  const since = -daysUntil(h.ips.lastReview);
  out.push({ area: "Governance", rule: "Policy reviewed within the last 12 months", actual: `${Math.round(since / 30.4)} months ago`, status: since > 365 ? "Breach" : since > 300 ? "Watch" : "Compliant" });
  return out;
}

// ── Rebalancing ─────────────────────────────────────────────────────────────────────────────────────────────────
export type Trade = { account: string; accountName: string; tax: TaxTreatment; action: "Sell" | "Buy"; symbol: string; cls: AssetClass; amount: number; gain: number };

const PREFER: Record<AssetClass, TaxTreatment[]> = {
  bonds: ["tax-deferred", "taxable", "tax-free"],
  realestate: ["tax-deferred", "tax-free", "taxable"],
  alts: ["tax-deferred", "tax-free", "taxable"],
  us: ["tax-free", "taxable", "tax-deferred"],
  intl: ["taxable", "tax-free", "tax-deferred"],
  cash: ["taxable", "tax-deferred", "tax-free"],
};

/** Trades that bring the policy portfolio back to target, selling in tax-advantaged accounts and loss lots first. */
export function rebalance(h: Household, v: Valuation) {
  const total = v.policy;
  // Bank and money-market accounts (cash only) can't hold funds, so they are left out of trading.
  const brokerage = (id: string) => v.positions.some((p) => p.account.id === id && p.symbol !== "$CASH");
  const positions = v.positions.filter((p) => p.account.inPolicy && brokerage(p.account.id)).map((p) => ({ ...p, left: p.value }));
  const trades: Trade[] = [];
  const proceeds = new Map<string, number>();
  const sell = (p: (typeof positions)[number], amt: number) => {
    trades.push({ account: p.account.id, accountName: p.account.name, tax: p.account.tax, action: "Sell", symbol: p.symbol, cls: p.cls, amount: amt, gain: p.account.tax === "taxable" ? (amt * p.gain) / p.value : 0 });
    proceeds.set(p.account.id, (proceeds.get(p.account.id) ?? 0) + amt);
    p.left -= amt;
  };
  // Lowest gain first, so each dollar sold realizes as little tax as possible.
  const byGain = (a: (typeof positions)[number], b: (typeof positions)[number]) => a.gain / a.value - b.gain / b.value;

  // 1. Bring any single security back under the IPS position limit.
  const singles = new Map<string, typeof positions>();
  positions.filter((p) => p.symbol !== "$CASH" && !isFund(p.symbol)).forEach((p) => singles.set(p.symbol, [...(singles.get(p.symbol) ?? []), p]));
  for (const lots of singles.values()) {
    let excess = sum(lots.map((p) => p.value)) - h.ips.limits.maxPosition * total;
    for (const p of lots.sort((a, b) => (a.account.tax === "taxable" ? 1 : 0) - (b.account.tax === "taxable" ? 1 : 0) || byGain(a, b))) {
      if (excess <= 1) break;
      const amt = Math.min(excess, p.left);
      sell(p, amt);
      excess -= amt;
    }
  }

  // 2. Rebalance each sleeve to target; gaps under half a percent of the portfolio are not worth trading.
  const bank = v.positions.filter((p) => p.account.inPolicy && !brokerage(p.account.id));
  const current = Object.fromEntries(CLASSES.map((c) => [c, sum(positions.filter((p) => p.cls === c).map((p) => p.left)) + sum(bank.filter((p) => p.cls === c).map((p) => p.value))])) as Record<AssetClass, number>;
  const gaps = CLASSES.map((c) => ({ cls: c, gap: (h.ips.targets.find((t) => t.cls === c)?.target ?? 0) * total - current[c] })).filter((g) => Math.abs(g.gap) >= 0.005 * total);
  for (const { cls, gap } of gaps.filter((g) => g.gap < 0)) {
    let left = -gap;
    const order = positions.filter((p) => p.cls === cls && p.left > 0).sort((a, b) => (a.account.tax === "taxable" ? 1 : 0) - (b.account.tax === "taxable" ? 1 : 0) || byGain(a, b));
    for (const p of order) {
      if (left <= 1) break;
      const amt = Math.min(left, p.left);
      sell(p, amt);
      left -= amt;
    }
  }

  const needs = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap).map((g) => ({ ...g }));
  const buy = (accountId: string, cls: AssetClass, amt: number) => {
    const a = v.accounts.find((x) => x.id === accountId)!;
    const held = positions.find((p) => p.account.id === accountId && p.cls === cls && (isFund(p.symbol) || p.symbol === "$CASH"));
    const symbol = held?.symbol ?? (cls === "cash" ? "$CASH" : CMA[cls].model);
    const existing = trades.find((t) => t.account === accountId && t.action === "Buy" && t.symbol === symbol);
    if (existing) existing.amount += amt;
    else trades.push({ account: accountId, accountName: a.name, tax: a.tax, action: "Buy", symbol, cls, amount: amt, gain: 0 });
  };
  // First pass honors asset-location preferences; the second places whatever cash is left.
  for (const pass of [0, 1])
    for (const n of needs)
      for (const tax of pass === 0 ? PREFER[n.cls] : (["taxable", "tax-deferred", "tax-free"] as TaxTreatment[]))
        for (const [id, cash] of proceeds) {
          if (n.gap <= 1) break;
          if (cash <= 1 || v.accounts.find((a) => a.id === id)?.tax !== tax) continue;
          const amt = Math.min(cash, n.gap);
          buy(id, n.cls, amt);
          proceeds.set(id, cash - amt);
          n.gap -= amt;
        }
  // Anything left over (from gaps too small to trade) stays in the account's cash sweep.
  for (const [id, cash] of proceeds) if (cash > 1) buy(id, "cash", cash);

  const realized = sum(trades.map((t) => t.gain));
  const rates = householdRates(h);
  const breaches = drift(h, v.policyWeights).filter((d) => d.breach);
  return {
    trades: trades.sort((a, b) => a.accountName.localeCompare(b.accountName) || (a.action === "Sell" ? -1 : 1)),
    turnover: sum(trades.filter((t) => t.action === "Sell").map((t) => t.amount)),
    realized,
    tax: Math.max(0, realized) * rates.gains,
    required: breaches.length > 0 || trades.some((t) => t.action === "Sell" && !isFund(t.symbol) && t.symbol !== "$CASH"),
    breaches,
  };
}

// ── Asset location ──────────────────────────────────────────────────────────────────────────────────────────────
/** Annual tax cost per dollar held in a taxable account. */
export function taxDrag(h: Household): Record<AssetClass, number> {
  const r = householdRates(h);
  return {
    bonds: CMA.bonds.yield * r.ordinary,
    realestate: CMA.realestate.yield * r.ordinary, // REIT dividends are mostly non-qualified
    cash: CMA.cash.yield * r.ordinary,
    alts: 0.01, // gold is taxed as a collectible (28%) when sold; spread as an annual equivalent
    us: CMA.us.yield * r.gains,
    intl: Math.max(0, CMA.intl.yield * r.gains - 0.002), // net of the foreign tax credit
  };
}

/** Place the least tax-efficient sleeves in tax-deferred accounts and the highest-growth sleeves in Roth accounts. */
export function assetLocation(h: Household, v: Valuation) {
  const accounts = v.accounts.filter((a) => a.inPolicy && a.tax !== "tax-exempt");
  const cap: Record<"taxable" | "tax-deferred" | "tax-free", number> = { taxable: 0, "tax-deferred": 0, "tax-free": 0 };
  accounts.forEach((a) => (cap[a.tax as keyof typeof cap] += a.value));
  const total = sum(Object.values(cap));
  const drag = taxDrag(h);
  const need = Object.fromEntries(CLASSES.map((c) => [c, (h.ips.targets.find((t) => t.cls === c)?.target ?? 0) * total])) as Record<AssetClass, number>;
  const plan = Object.fromEntries(CLASSES.map((c) => [c, { taxable: 0, "tax-deferred": 0, "tax-free": 0 }])) as Record<AssetClass, typeof cap>;
  const left = { ...cap };
  const fill = (bucket: keyof typeof cap, order: AssetClass[]) => {
    for (const c of order) {
      const amt = Math.min(left[bucket], need[c]);
      plan[c][bucket] += amt;
      need[c] -= amt;
      left[bucket] -= amt;
    }
  };
  fill("tax-deferred", [...CLASSES].sort((a, b) => drag[b] - drag[a]));
  fill("tax-free", [...CLASSES].sort((a, b) => CMA[b].mean - CMA[a].mean));
  fill("taxable", CLASSES);

  const currentTaxable = Object.fromEntries(CLASSES.map((c) => [c, sum(v.positions.filter((p) => p.account.inPolicy && p.account.tax === "taxable" && p.cls === c).map((p) => p.value))])) as Record<AssetClass, number>;
  const currentDrag = sum(CLASSES.map((c) => currentTaxable[c] * drag[c]));
  const optimalDrag = sum(CLASSES.map((c) => plan[c].taxable * drag[c]));
  const current = Object.fromEntries(CLASSES.map((c) => [c, {
    taxable: currentTaxable[c],
    "tax-deferred": sum(v.positions.filter((p) => p.account.inPolicy && p.account.tax === "tax-deferred" && p.cls === c).map((p) => p.value)),
    "tax-free": sum(v.positions.filter((p) => p.account.inPolicy && p.account.tax === "tax-free" && p.cls === c).map((p) => p.value)),
  }])) as Record<AssetClass, typeof cap>;
  return { capacity: cap, plan, current, drag, currentDrag, optimalDrag, saving: currentDrag - optimalDrag };
}

/** Taxable positions with harvestable losses and a similar replacement fund. */
export function harvest(h: Household, v: Valuation) {
  const r = householdRates(h);
  return v.positions
    .filter((p) => p.account.tax === "taxable" && p.symbol !== "$CASH" && p.gain < -1000 && p.gain / p.basis < -0.03)
    .map((p) => ({ ...p, replacement: HARVEST_PAIR[p.symbol] ?? (isFund(p.symbol) ? "a similar index fund" : "a sector ETF"), saving: -p.gain * r.gains }))
    .sort((a, b) => a.gain - b.gain);
}
