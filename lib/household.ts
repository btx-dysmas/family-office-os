// Household valuation: positions at market, the family balance sheet, ratios and entity roll-ups.
import { classify, CLASSES, zeroWeights, type Weights } from "./cma";
import { ageOn, sum, thisYear } from "./format";
import type { Account, AssetClass, EntityType, Household, OtherAssetKind, Person } from "./types";

export type Quote = { symbol: string; price: number | null; prev: number | null; name?: string; type?: string | null; date?: string };
export type Quotes = Record<string, Quote>;

export const ENTITY_LABEL: Record<EntityType, string> = {
  individual: "Individual", joint: "Joint", "revocable-trust": "Revocable trust", "irrevocable-trust": "Irrevocable trust", llc: "LLC",
  foundation: "Private foundation", daf: "Donor-advised fund", custodial: "Custodial (UTMA)", "529": "529 plan",
};
export const KIND_LABEL: Record<OtherAssetKind, string> = {
  residence: "Residences", "real-estate": "Investment real estate", "private-equity": "Private equity", venture: "Venture capital",
  business: "Operating business", art: "Art and collectibles", aircraft: "Aircraft and vessels", other: "Other",
};

/** Owned outright or through a revocable trust: counted in the taxable estate. */
const IN_ESTATE: Record<EntityType, boolean> = {
  individual: true, joint: true, "revocable-trust": true, llc: true, "irrevocable-trust": false, foundation: false, daf: false, custodial: false, "529": false,
};
/** Money the family can spend: excludes charitable vehicles, irrevocable trusts and a child's custodial account. */
const FAMILY_SPENDABLE: Record<EntityType, boolean> = { ...IN_ESTATE, "529": true };

export function inEstate(h: Household, entityId: string): boolean {
  const e = h.entities.find((x) => x.id === entityId);
  if (!e) return true;
  if (e.type === "llc" && e.parent) return inEstate(h, e.parent);
  return IN_ESTATE[e.type];
}
export const spendable = (h: Household, entityId: string): boolean => {
  const e = h.entities.find((x) => x.id === entityId);
  return e ? (e.type === "llc" && e.parent ? spendable(h, e.parent) : FAMILY_SPENDABLE[e.type]) : true;
};

export const priceOf = (symbol: string, fallback: number | undefined, q: Quotes) => (symbol === "$CASH" ? 1 : q[symbol]?.price ?? fallback ?? 0);

export function value(h: Household, q: Quotes) {
  const positions = h.accounts.flatMap((a) =>
    a.holdings.map((x) => {
      const price = priceOf(x.symbol, x.price, q), prev = x.symbol === "$CASH" ? 1 : q[x.symbol]?.prev ?? price;
      const mv = x.shares * price;
      return { account: a, symbol: x.symbol, name: x.symbol === "$CASH" ? "Cash and money market" : q[x.symbol]?.name ?? x.symbol, cls: classify(x.symbol) as AssetClass,
        shares: x.shares, price, value: mv, basis: x.basis, gain: mv - x.basis, day: x.shares * (price - prev) };
    }),
  );
  const accounts = h.accounts.map((a) => {
    const ps = positions.filter((p) => p.account.id === a.id);
    return { ...a, value: sum(ps.map((p) => p.value)), day: sum(ps.map((p) => p.day)) };
  });
  const weights = (filter: (a: Account) => boolean) => {
    const w = zeroWeights();
    const ps = positions.filter((p) => filter(p.account));
    const t = sum(ps.map((p) => p.value)) || 1;
    ps.forEach((p) => (w[p.cls] += p.value / t));
    return w;
  };

  const liquid = sum(accounts.map((a) => a.value));
  const policy = sum(accounts.filter((a) => a.inPolicy).map((a) => a.value));
  const investable = sum(accounts.filter((a) => spendable(h, a.entity)).map((a) => a.value));
  const charitable = sum(accounts.filter((a) => ["foundation", "daf"].includes(h.entities.find((e) => e.id === a.entity)?.type ?? "")).map((a) => a.value));
  const cash = sum(positions.filter((p) => p.cls === "cash" && spendable(h, p.account.entity)).map((p) => p.value));
  const otherTotal = sum(h.other.map((o) => o.value));
  const residences = sum(h.other.filter((o) => o.kind === "residence").map((o) => o.value));
  const illiquid = otherTotal - residences;
  const debt = sum(h.liabilities.map((l) => l.balance));
  const assets = liquid + otherTotal;
  const netWorth = assets - debt;

  const byKind = new Map<string, number>();
  h.other.forEach((o) => byKind.set(KIND_LABEL[o.kind], (byKind.get(KIND_LABEL[o.kind]) ?? 0) + o.value));

  const entityValue = (id: string) =>
    sum(accounts.filter((a) => a.entity === id).map((a) => a.value)) + sum(h.other.filter((o) => o.entity === id).map((o) => o.value)) - sum(h.liabilities.filter((l) => l.entity === id).map((l) => l.balance));

  const estate = sum(accounts.filter((a) => inEstate(h, a.entity)).map((a) => a.value)) + sum(h.other.filter((o) => inEstate(h, o.entity)).map((o) => o.value)) - sum(h.liabilities.filter((l) => inEstate(h, l.entity)).map((l) => l.balance));
  const monthlyDebtService = sum(h.liabilities.map((l) => l.payment));

  return {
    positions, accounts, liquid, policy, investable, charitable, cash, otherTotal, residences, illiquid, debt, assets, netWorth, estate,
    day: sum(accounts.map((a) => a.day)),
    policyWeights: weights((a) => a.inPolicy),
    byKind: [...byKind.entries()].sort((a, b) => b[1] - a[1]),
    entityValue,
    ratios: {
      debtToAssets: assets ? debt / assets : 0,
      liquidityMonths: h.expenses ? cash / (h.expenses / 12) : 0,
      liquidToDebt: debt ? liquid / debt : Infinity,
      illiquidShare: assets - residences > 0 ? illiquid / (assets - residences) : 0,
      debtService: monthlyDebtService,
      savingsRate: income(h) ? h.savings / income(h) : 0,
    },
  };
}
export type Valuation = ReturnType<typeof value>;

export const income = (h: Household) => sum(h.people.map((p) => p.income ?? 0));
export const clients = (h: Household) => h.people.filter((p) => p.relationship === "client" || p.relationship === "spouse");
export const primary = (h: Household): Person => h.people.find((p) => p.relationship === "client") ?? h.people[0];
export const age = (p: Person) => ageOn(p.dob);
export const retireYear = (p: Person) => Number(p.dob.slice(0, 4)) + (p.retireAge ?? 65);
export const yearsToRetire = (h: Household) => Math.max(0, retireYear(primary(h)) - thisYear());

/** Allocation drift of the policy portfolio against IPS targets. */
export function drift(h: Household, w: Weights) {
  return CLASSES.map((cls) => {
    const t = h.ips.targets.find((x) => x.cls === cls) ?? { cls, target: 0, min: 0, max: 0 };
    const cur = w[cls] ?? 0;
    return { ...t, current: cur, diff: cur - t.target, breach: cur < t.min - 1e-9 || cur > t.max + 1e-9 };
  });
}

/** The IPS target mix as a weights object. */
export const targetWeights = (h: Household): Weights => {
  const w = zeroWeights();
  h.ips.targets.forEach((t) => (w[t.cls] = t.target));
  return w;
};
