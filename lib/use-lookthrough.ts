"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "./data";
import type { Valuation } from "./household";

export type Fund = {
  symbol: string; name: string; type: string | null; category: string | null; family: string | null; expense: number | null; assets: number | null; yield: number | null;
  inception: string | null; sectors: { sector: string; weight: number }[]; holdings: { symbol: string | null; name: string; weight: number }[];
  stockPct: number | null; bondPct: number | null; cashPct: number | null; sector: string | null;
  trailing: { ytd: number | null; oneYear: number | null; threeYear: number | null; fiveYear: number | null; tenYear: number | null; asOf: string | null };
  annual: { year: number; value: number }[];
};

export const SECTOR_LABEL: Record<string, string> = {
  technology: "Technology", financial_services: "Financials", healthcare: "Health care", consumer_cyclical: "Consumer discretionary",
  communication_services: "Communication", industrials: "Industrials", consumer_defensive: "Consumer staples", energy: "Energy",
  realestate: "Real estate", basic_materials: "Materials", utilities: "Utilities",
};
// Stock sectors arrive as "Financial Services"; fund weights use keys like "financial_services".
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "_").replace("real_estate", "realestate");

/** Fund profiles for every holding, and the household's look-through sector and security exposures. */
export function useLookThrough(v: Valuation) {
  const symbols = [...new Set(v.positions.filter((p) => p.account.inPolicy && p.symbol !== "$CASH").map((p) => p.symbol))].sort();
  const key = symbols.join(",");
  const [funds, setFunds] = useState<Record<string, Fund>>({});
  useEffect(() => {
    let live = true;
    Promise.all(key.split(",").filter(Boolean).map((s) => fetchJson<Fund>(`/api/fund/${s}`).catch(() => null))).then((rs) => {
      if (live) setFunds(Object.fromEntries(rs.filter(Boolean).map((f) => [f!.symbol, f!])));
    });
    return () => { live = false; };
  }, [key]);

  const policy = v.positions.filter((p) => p.account.inPolicy && p.symbol !== "$CASH");
  const total = v.policy || 1;
  const sectors = new Map<string, number>(), names = new Map<string, { name: string; weight: number }>();
  let equity = 0;
  for (const p of policy) {
    const f = funds[p.symbol], w = p.value / total;
    if (!f) continue;
    if (f.type === "EQUITY") {
      const s = norm(f.sector ?? "other");
      sectors.set(s, (sectors.get(s) ?? 0) + w);
      names.set(p.symbol, { name: f.name, weight: (names.get(p.symbol)?.weight ?? 0) + w });
      equity += w;
    } else {
      const eq = f.stockPct ?? (f.sectors.length ? 1 : 0);
      f.sectors.forEach((s) => sectors.set(s.sector, (sectors.get(s.sector) ?? 0) + w * eq * s.weight));
      equity += w * eq;
      f.holdings.forEach((x) => {
        const k = x.symbol ?? x.name;
        names.set(k, { name: x.name, weight: (names.get(k)?.weight ?? 0) + w * x.weight });
      });
    }
  }
  const sectorList = [...sectors.entries()].map(([k, w]) => ({ sector: SECTOR_LABEL[k] ?? k, weight: w, ofEquity: equity ? w / equity : 0 })).sort((a, b) => b.weight - a.weight);
  const tech = sectorList.find((s) => s.sector === "Technology");
  return {
    funds, loaded: symbols.every((s) => funds[s]) && symbols.length > 0,
    sectors: sectorList, top: [...names.entries()].map(([k, x]) => ({ symbol: k, ...x })).sort((a, b) => b.weight - a.weight).slice(0, 12),
    techShare: tech && equity ? tech.weight / equity : null,
  };
}
