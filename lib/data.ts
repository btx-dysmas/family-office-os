"use client";
// Client data hooks. Responses are cached per URL for the session so moving between pages doesn't refetch.
import { useEffect, useMemo, useState } from "react";
import { buildPlan, simulate } from "./montecarlo";
import { value, type Quotes } from "./household";
import type { Macro } from "./server/macro";
import type { Household } from "./types";

const cache = new Map<string, Promise<unknown>>();

export function fetchJson<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    const p = fetch(url).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail || `Request failed (${r.status})`);
      return j;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url) as Promise<T>;
}

export function useApi<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetchJson<T>(url).then((data) => live && setState({ url, data, error: null })).catch((e) => live && setState({ url, data: null, error: e.message }));
    return () => { live = false; };
  }, [url]);
  const current = state.url === url;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!url && (!current || (!state.data && !state.error)) };
}

export function useQuotes(symbols: string[]) {
  const key = [...new Set(symbols.filter((s) => s && s !== "$CASH"))].sort().join(",");
  const { data } = useApi<Quotes>(key ? `/api/quotes?symbols=${encodeURIComponent(key)}` : null);
  return data ?? {};
}

export const useMacro = () => useApi<Macro>("/api/macro");

export const holdingSymbols = (households: Household[]) => households.flatMap((h) => h.accounts.flatMap((a) => a.holdings.map((x) => x.symbol)));

/** Everything the household pages share: live valuation, the plan and a 5,000-path simulation. */
export function useModel(h: Household | null, quotes: Quotes, runs = 5000) {
  const v = useMemo(() => (h ? value(h, quotes) : null), [h, quotes]);
  const plan = useMemo(() => (h && v ? buildPlan(h, v) : null), [h, v]);
  const mc = useMemo(() => (plan ? simulate(plan, runs) : null), [plan, runs]);
  return { v, plan, mc };
}
