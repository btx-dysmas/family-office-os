// Asset-class returns over historical crisis windows, from long-history index mutual funds.
import { HISTORICAL, PROXIES, type ScenarioData } from "@/lib/stress";
import type { AssetClass } from "@/lib/types";
import { HOUR, memo } from "./cache";
import { between } from "./yahoo";

const addYears = (d: string, n: number) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;

export function scenarios(): Promise<ScenarioData[]> {
  return memo("stress", 24 * HOUR, () =>
    Promise.all(
      HISTORICAL.map(async (s) => {
        const until = [addYears(s.start, 6), new Date().toISOString().slice(0, 10)].sort()[0];
        const series = await Promise.all(PROXIES.map(async ([cls, sym]) => [cls, sym, await between(sym, s.start, until).catch(() => null)] as const));
        // Weekly calendar from the U.S. stock proxy, which has the longest clean history.
        const base = series[0][2];
        const dates = (base?.dates ?? []).filter((_, i) => i % 5 === 0);
        const notes: string[] = [];
        const returns = {} as Record<AssetClass, number | null>;
        const levels = {} as Record<AssetClass, (number | null)[]>;
        for (const [cls, sym, h] of series) {
          if (!h?.dates.length) { returns[cls] = null; levels[cls] = dates.map(() => null); notes.push(`${sym}: no data`); continue; }
          const first = h.adj.findIndex((v) => v != null);
          if (h.dates[first] > s.start) notes.push(`${sym} history starts ${h.dates[first]}; measured from then`);
          const idx = new Map(h.dates.map((d, i) => [d, i]));
          const at = (d: string) => {
            let i = idx.get(d);
            if (i == null) i = h.dates.findIndex((x) => x >= d);
            if (i == null || i < 0) i = h.dates.length - 1;
            for (let k = i; k >= 0; k--) if (h.adj[k] != null) return h.adj[k] as number;
            return null;
          };
          const p0 = h.adj[first] as number;
          const pEnd = at(s.end);
          returns[cls] = pEnd != null ? pEnd / p0 - 1 : null;
          levels[cls] = dates.map((d) => (d < h.dates[first] ? 1 : ((at(d) ?? p0) / p0)));
        }
        return { id: s.id, returns, path: { dates, levels }, notes };
      }),
    ),
  );
}
