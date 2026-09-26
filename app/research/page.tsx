"use client";
import { useEffect, useState } from "react";
import { KV, Loading, Note, PageHeader, Panel, Pill } from "@/components/kit";
import Plot from "@/components/Plot";
import { Button } from "@/components/ui/button";
import type { Prices } from "@/lib/analytics";
import { bars, C, growth, hbars } from "@/lib/charts";
import { classify, CLASS_LABEL } from "@/lib/cma";
import { fetchJson, useApi } from "@/lib/data";
import { date, money, pct, tone } from "@/lib/format";
import { SECTOR_LABEL, type Fund } from "@/lib/use-lookthrough";

const POPULAR = ["VOO", "VTI", "SCHD", "QQQ", "BND"];
type NPort = { symbol: string; missing?: boolean; tooLarge?: boolean; filing?: string; period?: string; netAssets?: number; count?: number; top10?: number; top?: { name: string; value: number; weight: number; asset: string; country: string }[]; byAsset?: [string, number][]; byCountry?: [string, number][] };

function Compare({ onPick }: { onPick: (s: string) => void }) {
  const [rows, setRows] = useState<Fund[]>([]);
  useEffect(() => { Promise.all(POPULAR.map((s) => fetchJson<Fund>(`/api/fund/${s}`).catch(() => null))).then((r) => setRows(r.filter(Boolean) as Fund[])); }, []);
  if (!rows.length) return <Loading label="Loading fund profiles" />;
  return (
    <div className="overflow-x-auto">
      <table className="grid-table">
        <thead><tr><th>Fund</th><th>Sleeve</th><th className="r">Expense ratio</th><th className="r">Yield</th><th className="r">Assets</th><th className="r">1 yr</th><th className="r">3 yr (ann.)</th><th className="r">5 yr (ann.)</th><th className="r">10 yr (ann.)</th><th className="r">Top 10 weight</th></tr></thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.symbol} className="cursor-pointer" onClick={() => onPick(f.symbol)}>
              <td><span className="font-medium">{f.symbol}</span> <span className="text-muted-foreground">{f.name}</span></td>
              <td className="text-muted-foreground">{CLASS_LABEL[classify(f.symbol)]}</td>
              <td className="r">{pct(f.expense, 2)}</td><td className="r">{pct(f.yield, 2)}</td><td className="r">{money(f.assets)}</td>
              {(["oneYear", "threeYear", "fiveYear", "tenYear"] as const).map((k) => <td key={k} className={`r ${tone(f.trailing[k])}`}>{pct(f.trailing[k])}</td>)}
              <td className="r">{f.holdings.length ? pct(f.holdings.reduce((s, x) => s + x.weight, 0)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Research() {
  const [symbol, setSymbol] = useState("VOO");
  const [input, setInput] = useState("");
  const { data: f, error } = useApi<Fund>(`/api/fund/${symbol}`);
  const { data: np, loading: npLoading } = useApi<NPort>(`/api/nport/${symbol}`);
  const { data: px } = useApi<Prices>(`/api/prices?range=10y&symbols=${symbol}`);
  const series = px?.series[symbol];
  const first = series?.findIndex((x) => x != null) ?? -1;
  const g = series && first >= 0 ? { dates: px!.dates.slice(first), fund: series.slice(first).map((x) => ((x ?? series[first]!) / series[first]!) * 10000), spy: px!.bench.slice(first).map((x) => ((x ?? px!.bench[first]!) / px!.bench[first]!) * 10000) } : null;

  return (
    <>
      <PageHeader eyebrow="Research" title="Fund analysis" sub="Costs, exposures and history for the funds families actually own. Holdings come straight from each fund's latest SEC Form N-PORT filing."
        actions={
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) { setSymbol(input.trim().toUpperCase()); setInput(""); } }}>
            <input className="field w-40 uppercase placeholder:normal-case" placeholder="Any fund ticker" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Fund ticker" />
            <Button type="submit" variant="outline">Analyze</Button>
          </form>
        } />

      <Panel title="Popular funds compared" sub="Click a row to analyze it" pad={false}><Compare onPick={setSymbol} /></Panel>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {POPULAR.map((s) => <Button key={s} size="sm" variant={s === symbol ? "default" : "secondary"} onClick={() => setSymbol(s)}>{s}</Button>)}
        {!POPULAR.includes(symbol) && <Button size="sm">{symbol}</Button>}
      </div>

      {error && <Panel className="mt-4"><p className="text-[13px] text-neg">{error}</p></Panel>}
      {!f && !error && <Loading label={`Loading ${symbol}`} />}
      {f && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Panel title={<span className="font-serif text-[24px] font-normal">{f.symbol}</span>} sub={f.name}>
              <KV rows={[
                ["Fund family", f.family ?? "—"], ["Category", f.category ?? "—"], ["Asset class in this platform", CLASS_LABEL[classify(f.symbol)]],
                ["Expense ratio", pct(f.expense, 2)], ["Cost per $1M invested", f.expense != null ? `$${Math.round(f.expense * 1e6).toLocaleString("en-US")}/yr` : "—"],
                ["Yield", pct(f.yield, 2)], ["Net assets", money(f.assets)], ["Inception", date(f.inception)],
                ["Stocks / bonds / cash", `${pct(f.stockPct, 0)} / ${pct(f.bondPct, 0)} / ${pct(f.cashPct, 0)}`],
              ]} />
            </Panel>
            <Panel title="Growth of $10,000" sub={`Total return with dividends reinvested, against the S&P 500 (SPY)`}>
              {g ? <Plot fig={growth(g.dates, [{ name: f.symbol, y: g.fund, color: C.gold }, { name: "S&P 500", y: g.spy, color: C.ink3, dash: "dot" }])} height={300} /> : <Loading label="Loading price history" />}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Sector allocation" sub="Share of equity holdings">
              {f.sectors.length ? <Plot fig={hbars(f.sectors.slice().sort((a, b) => b.weight - a.weight).map((s) => SECTOR_LABEL[s.sector] ?? s.sector), f.sectors.slice().sort((a, b) => b.weight - a.weight).map((s) => s.weight), C.c2)} height={300} /> : <p className="text-[13px] text-muted-foreground">Not reported for this fund.</p>}
            </Panel>
            <Panel title="Calendar-year returns">
              {f.annual.length ? <Plot fig={bars(f.annual.slice(0, 10).reverse().map((a) => String(a.year)), f.annual.slice(0, 10).reverse().map((a) => a.value), f.annual.slice(0, 10).reverse().map((a) => (a.value >= 0 ? C.pos : C.neg)), ".0%")} height={300} /> : <p className="text-[13px] text-muted-foreground">Not reported.</p>}
            </Panel>
            <Panel title="Trailing returns" sub={f.trailing.asOf ? `As of ${date(f.trailing.asOf)}` : undefined}>
              <KV rows={([["Year to date", "ytd"], ["1 year", "oneYear"], ["3 years (annualized)", "threeYear"], ["5 years (annualized)", "fiveYear"], ["10 years (annualized)", "tenYear"]] as const).map(([k, key]) => [k, <span key={key} className={tone(f.trailing[key])}>{pct(f.trailing[key])}</span>])} />
            </Panel>
          </div>

          <Panel title="Complete holdings" sub={np?.period ? `SEC Form N-PORT for the period ending ${date(np.period)}` : "SEC Form N-PORT"}
            action={np?.filing && <a href={np.filing} target="_blank" rel="noopener noreferrer" className="text-[12px] text-gold hover:underline">View filing on EDGAR</a>}>
            {npLoading ? <Loading label="Reading the latest N-PORT filing from EDGAR" /> : !np || np.missing ? <p className="text-[13px] text-muted-foreground">No N-PORT filing found for {symbol}. Unit investment trusts and some older structures do not file N-PORT.</p> : np.tooLarge ? <p className="text-[13px] text-muted-foreground">This fund&apos;s filing lists tens of thousands of positions, too large to parse within a serverless request. Top holdings from the fund profile are shown instead: {f.holdings.slice(0, 5).map((x) => x.name).join(", ")}.</p> : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div className="overflow-x-auto">
                  <table className="grid-table">
                    <thead><tr><th>#</th><th>Holding</th><th>Type</th><th>Country</th><th className="r">Value</th><th className="r">Weight</th></tr></thead>
                    <tbody>{np.top!.map((x, i) => <tr key={i}><td className="text-muted-foreground">{i + 1}</td><td className="font-medium">{x.name}</td><td className="text-muted-foreground">{x.asset}</td><td className="text-muted-foreground">{x.country}</td><td className="r">{money(x.value)}</td><td className="r">{pct(x.weight, 2)}</td></tr>)}</tbody>
                  </table>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-md border border-border bg-subtle p-3"><div className="eyebrow">Positions</div><div className="num mt-1 text-[20px] font-semibold">{np.count!.toLocaleString("en-US")}</div></div>
                    <div className="rounded-md border border-border bg-subtle p-3"><div className="eyebrow">Top 10</div><div className="num mt-1 text-[20px] font-semibold">{pct(np.top10)}</div></div>
                    <div className="rounded-md border border-border bg-subtle p-3"><div className="eyebrow">Net assets</div><div className="num mt-1 text-[20px] font-semibold">{money(np.netAssets)}</div></div>
                  </div>
                  <div><div className="eyebrow mb-2">By asset type</div><div className="flex flex-wrap gap-2">{np.byAsset!.map(([k, w]) => <Pill key={k}>{k} {pct(w, 1)}</Pill>)}</div></div>
                  <div><div className="eyebrow mb-2">By country</div><div className="flex flex-wrap gap-2">{np.byCountry!.map(([k, w]) => <Pill key={k}>{k} {pct(w, 1)}</Pill>)}</div></div>
                  <Note>Top 10 weight measures concentration: a high number means a few companies drive results even in a &quot;diversified&quot; fund.</Note>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
