// FRED series, the Treasury par yield curve and a few market gauges used by the regime and committee rules.
import { forget, HOUR, memo } from "./cache";
import { history, marketValuation } from "./yahoo";

const KEY = (process.env.FRED_API_KEY ?? "").trim();
const START = "2007-01-01";

export const SERIES: [id: string, title: string, transform?: "yoy"][] = [
  ["DGS10", "10-year Treasury yield"],
  ["DGS2", "2-year Treasury yield"],
  ["DTB3", "3-month Treasury bill"],
  ["T10Y2Y", "10-year less 2-year spread"],
  ["DFF", "Effective federal funds rate"],
  ["CPIAUCSL", "CPI inflation, year over year", "yoy"],
  ["UNRATE", "Unemployment rate"],
  ["A191RL1Q225SBEA", "Real GDP growth, annualized"],
  ["BAA10Y", "Baa corporate spread"],
  ["VIXCLS", "VIX"],
  ["MORTGAGE30US", "30-year fixed mortgage rate"],
];

export type Obs = [string, number][];

async function observations(id: string): Promise<Obs> {
  const q = new URLSearchParams({ series_id: id, api_key: KEY, file_type: "json", observation_start: START });
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?${q}`, { cache: "no-store" });
  if (!r.ok) {
    const why = await r.json().then((j) => j.error_message).catch(() => null);
    throw new Error(why ? `FRED: ${why}` : `FRED ${id}: HTTP ${r.status}`);
  }
  const data = await r.json();
  return (data.observations ?? []).filter((o: { value: string }) => o.value !== ".").map((o: { date: string; value: string }) => [o.date, Number(o.value)]);
}

const yoy = (obs: Obs): Obs => {
  const by = new Map(obs);
  return obs.flatMap(([d, v]) => {
    const prev = by.get(`${Number(d.slice(0, 4)) - 1}${d.slice(4)}`);
    return prev ? [[d, Math.round((v / prev - 1) * 10000) / 100] as [string, number]] : [];
  });
};

// Daily series are thinned to one point a week to keep the payload small.
const weekly = (obs: Obs): Obs => {
  const out = new Map<string, [string, number]>();
  for (const [d, v] of obs) out.set(`${d.slice(0, 4)}-${Math.floor((Date.parse(d) - Date.parse(d.slice(0, 4) + "-01-01")) / 6048e5)}`, [d, v]);
  return [...out.values()];
};

export async function treasuryCurve() {
  const year = new Date().getUTCFullYear();
  const get = async (y: number) => {
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return [];
    const [head, ...lines] = (await r.text()).trim().split("\n");
    const cols = head.split(",").map((c) => c.replace(/"/g, ""));
    return lines.map((l) => {
      const cells = l.split(",");
      const [m, d, yy] = cells[0].split("/");
      return { date: `${yy}-${m}-${d}`, values: Object.fromEntries(cols.slice(1).map((c, i) => [c, cells[i + 1] ? Number(cells[i + 1]) : null])) as Record<string, number | null> };
    });
  };
  const rows = [...(await get(year)), ...(await get(year - 1))].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!rows.length) return null;
  const tenors = ["1 Mo", "3 Mo", "6 Mo", "1 Yr", "2 Yr", "3 Yr", "5 Yr", "7 Yr", "10 Yr", "20 Yr", "30 Yr"];
  const at = (daysBack: number) => {
    const target = new Date(Date.parse(rows[0].date) - daysBack * 864e5).toISOString().slice(0, 10);
    const r = rows.find((x) => x.date <= target);
    return r ? { date: r.date, yields: tenors.map((t) => r.values[t] ?? null) } : null;
  };
  return { tenors, latest: at(0), monthAgo: at(30), yearAgo: at(365) };
}

async function spyTrend() {
  const h = await history("SPY", "1y");
  const px = (h?.adj ?? []).filter((v): v is number => v != null);
  if (px.length < 200) return null;
  const ma200 = px.slice(-200).reduce((a, b) => a + b, 0) / 200;
  return { last: px.at(-1)!, ma200, oneYear: px.at(-1)! / px[0] - 1 };
}

export async function macro() {
  const m = await memo("macro", 6 * HOUR, async () => {
    const series: Record<string, { id: string; title: string; obs?: Obs; latest?: [string, number] | null; chg1y?: number | null; error?: string }> = {};
    if (KEY)
      await Promise.all(
        SERIES.map(async ([id, title, tf]) => {
          try {
            let obs = await observations(id);
            if (tf === "yoy") obs = yoy(obs);
            if (obs.length > 1500) obs = weekly(obs);
            const latest = obs.at(-1) ?? null;
            const back = latest ? `${Number(latest[0].slice(0, 4)) - 1}${latest[0].slice(4)}` : "";
            const yearAgo = [...obs].reverse().find(([d]) => d <= back);
            series[id] = { id, title, obs, latest, chg1y: latest && yearAgo ? Math.round((latest[1] - yearAgo[1]) * 100) / 100 : null };
          } catch (e) {
            series[id] = { id, title, error: e instanceof Error ? e.message : String(e) };
          }
        }),
      );
    const [curve, trend, val] = await Promise.all([treasuryCurve().catch(() => null), spyTrend().catch(() => null), marketValuation().catch(() => null)]);
    const available = Object.values(series).some((s) => s.obs);
    const pick = (id: string) => series[id]?.latest?.[1] ?? null;
    return {
      keyConfigured: !!KEY, available, series, curve, market: { ...trend, pe: val?.pe ?? null },
      rates: { tbill: pick("DTB3"), tenYear: curve?.latest?.yields[8] ?? pick("DGS10"), mortgage: pick("MORTGAGE30US") },
    };
  });
  if (!m.available) forget("macro"); // retry next time rather than holding on to a failure
  return m;
}
export type Macro = Awaited<ReturnType<typeof macro>>;
