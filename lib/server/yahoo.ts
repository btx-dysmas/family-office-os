// Yahoo Finance: quotes, daily history and fund data. Free but unofficial, so every field is treated as optional.
import { HOUR, memo } from "./cache";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const day = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
const raw = (x: unknown): number | null => {
  const v = typeof x === "object" && x !== null ? (x as { raw?: unknown }).raw : x;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

// quoteSummary needs a session cookie and a matching crumb.
let session: { cookie: string; crumb: string; at: number } | null = null;
async function getSession(force = false) {
  if (session && !force && Date.now() - session.at < HOUR * 1000) return session;
  const r = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual", cache: "no-store" });
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const c = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store" });
  session = { cookie, crumb: (await c.text()).trim(), at: Date.now() };
  return session;
}

async function quoteSummary(symbol: string, modules: string[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await getSession(attempt > 0);
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules.join(",")}&crumb=${encodeURIComponent(s.crumb)}`;
    const r = await fetch(url, { headers: { "User-Agent": UA, Cookie: s.cookie }, cache: "no-store" });
    if (r.ok) return (await r.json()).quoteSummary?.result?.[0] ?? null;
    if (r.status !== 401 && r.status !== 403) return null;
  }
  return null;
}

type Chart = { dates: string[]; close: (number | null)[]; adj: (number | null)[]; meta: Record<string, unknown> };

async function chart(symbol: string, query: string): Promise<Chart | null> {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!r.ok) return null;
  const res = (await r.json()).chart?.result?.[0];
  if (!res?.timestamp) return null;
  const q = res.indicators.quote[0];
  return { dates: res.timestamp.map(day), close: q.close, adj: res.indicators.adjclose?.[0]?.adjclose ?? q.close, meta: res.meta };
}

/** Last price and previous close. */
export function quote(symbol: string) {
  return memo(`q:${symbol}`, 900, async () => {
    const c = await chart(symbol, "range=5d&interval=1d");
    if (!c) return null;
    const m = c.meta as { regularMarketPrice?: number; chartPreviousClose?: number; longName?: string; shortName?: string; instrumentType?: string };
    const closes = c.close.filter((v): v is number => v != null);
    const prev = closes.length > 1 ? closes[closes.length - 2] : m.chartPreviousClose ?? null;
    return { symbol, price: m.regularMarketPrice ?? closes.at(-1) ?? null, prev, name: m.longName || m.shortName || symbol, type: m.instrumentType ?? null, date: c.dates.at(-1) };
  });
}

/** Adjusted daily closes for the last `range` (e.g. 5y). */
export function history(symbol: string, range = "5y") {
  return memo(`h:${symbol}:${range}`, 3 * HOUR, async () => {
    const c = await chart(symbol, `range=${range}&interval=1d`);
    return c ? { dates: c.dates, adj: c.adj } : null;
  });
}

/** Adjusted daily closes between two dates (for historical stress windows). */
export function between(symbol: string, from: string, to: string) {
  return memo(`b:${symbol}:${from}:${to}`, 24 * HOUR, async () => {
    const p1 = Math.floor(Date.parse(from) / 1000), p2 = Math.floor(Date.parse(to) / 1000) + 86400;
    const c = await chart(symbol, `period1=${p1}&period2=${p2}&interval=1d`);
    return c ? { dates: c.dates, adj: c.adj } : null;
  });
}

/** Fund profile: expense ratio, assets, yield, sector weights, top holdings, trailing and calendar-year returns. */
export function fund(symbol: string) {
  return memo(`fund:${symbol}`, 12 * HOUR, async () => {
    const q = await quoteSummary(symbol, ["fundProfile", "topHoldings", "defaultKeyStatistics", "fundPerformance", "summaryDetail", "price", "assetProfile"]);
    if (!q) return null;
    const fp = q.fundProfile ?? {}, th = q.topHoldings ?? {}, ks = q.defaultKeyStatistics ?? {}, perf = q.fundPerformance ?? {}, sd = q.summaryDetail ?? {}, pr = q.price ?? {};
    const tr = perf.trailingReturns ?? {};
    return {
      symbol,
      name: pr.longName || pr.shortName || symbol,
      type: pr.quoteType ?? null,
      family: fp.family ?? null,
      category: fp.categoryName ?? null,
      expense: raw(fp.feesExpensesInvestment?.annualReportExpenseRatio) ?? raw(sd.expenseRatio) ?? raw(ks.annualReportExpenseRatio),
      assets: raw(ks.totalAssets) ?? raw(sd.totalAssets),
      yield: raw(sd.yield) ?? raw(ks.yield),
      inception: raw(ks.fundInceptionDate) ? day(raw(ks.fundInceptionDate)!) : null,
      sectors: (th.sectorWeightings ?? []).map((o: Record<string, unknown>) => {
        const [k, v] = Object.entries(o)[0];
        return { sector: k, weight: raw(v) ?? 0 };
      }).filter((s: { weight: number }) => s.weight > 0),
      holdings: (th.holdings ?? []).map((x: { symbol?: string; holdingName?: string; holdingPercent?: unknown }) => ({ symbol: x.symbol ?? null, name: x.holdingName ?? "", weight: raw(x.holdingPercent) ?? 0 })),
      stockPct: raw(th.stockPosition), bondPct: raw(th.bondPosition), cashPct: raw(th.cashPosition),
      trailing: { ytd: raw(tr.ytd), oneYear: raw(tr.oneYear), threeYear: raw(tr.threeYear), fiveYear: raw(tr.fiveYear), tenYear: raw(tr.tenYear), asOf: raw(tr.asOfDate) ? day(raw(tr.asOfDate)!) : null },
      annual: (perf.annualTotalReturns?.returns ?? []).map((r: { year: string; annualValue?: unknown }) => ({ year: Number(r.year), value: raw(r.annualValue) })).filter((r: { value: number | null }) => r.value != null),
      sector: q.assetProfile?.sector ?? null,
    };
  });
}

/** S&P 500 trailing P/E (via SPY), used by the investment committee rules. */
export function marketValuation() {
  return memo("spy:val", 6 * HOUR, async () => {
    const q = await quoteSummary("SPY", ["summaryDetail"]);
    return { pe: raw(q?.summaryDetail?.trailingPE) };
  });
}
