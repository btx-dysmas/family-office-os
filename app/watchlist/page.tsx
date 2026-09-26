"use client";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Loading, PageHeader, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import type { Prices } from "@/lib/analytics";
import { classify, CLASS_LABEL } from "@/lib/cma";
import { useApi, useMacro, useQuotes } from "@/lib/data";
import { pct, tone, usd } from "@/lib/format";
import { actions, useBook } from "@/lib/store";

function Spark({ data }: { data: number[] }) {
  if (data.length < 5) return null;
  const w = 110, h = 28, lo = Math.min(...data), hi = Math.max(...data);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} aria-hidden="true"><polyline fill="none" stroke={data.at(-1)! >= data[0] ? "var(--pos)" : "var(--neg)"} strokeWidth={1.4} points={pts} /></svg>;
}

export default function Watchlist() {
  const { watch } = useBook();
  const [add, setAdd] = useState("");
  const quotes = useQuotes(watch);
  const { data: px } = useApi<Prices>(watch.length ? `/api/prices?range=1y&symbols=${[...watch].sort().join(",")}` : null);
  const { data: macro } = useMacro();
  const ytdStart = px?.dates.findIndex((d) => d >= `${new Date().getFullYear()}-01-01`) ?? -1;
  const change = (s: (number | null)[], back: number) => { const clean = s.filter((x): x is number => x != null); return clean.length > back ? clean.at(-1)! / clean[clean.length - 1 - back] - 1 : null; };
  const curve = macro?.curve;
  const tenors = curve ? [["2-year", 4], ["5-year", 6], ["10-year", 8], ["30-year", 10]] as const : [];

  return (
    <>
      <PageHeader eyebrow="Research" title="Watchlist" sub="Stocks, funds and Treasury yields the team is tracking. Saved in this browser."
        actions={
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const s = add.trim().toUpperCase(); if (s && !watch.includes(s)) actions.setWatch([...watch, s]); setAdd(""); }}>
            <input className="field w-36 uppercase placeholder:normal-case" placeholder="Add ticker" value={add} onChange={(e) => setAdd(e.target.value)} aria-label="Ticker" />
            <Button type="submit" variant="outline"><Plus /> Add</Button>
          </form>
        } />
      <Panel title="Securities" pad={false}>
        <div className="overflow-x-auto">
          <table className="grid-table">
            <thead><tr><th>Symbol</th><th>Type</th><th className="r">Price</th><th className="r">Day</th><th className="r">1 month</th><th className="r">3 months</th><th className="r">Year to date</th><th className="r">1 year</th><th>12 months</th><th /></tr></thead>
            <tbody>
              {watch.map((s) => {
                const q = quotes[s], series = px?.series[s] ?? [];
                const day = q?.price != null && q.prev ? q.price / q.prev - 1 : null;
                const ytd = ytdStart >= 0 && series[ytdStart] && series.at(-1) ? series.at(-1)! / series[ytdStart]! - 1 : null;
                return (
                  <tr key={s}>
                    <td><span className="font-medium">{s}</span><div className="max-w-[220px] truncate text-[11.5px] text-muted-foreground">{q?.name ?? ""}</div></td>
                    <td className="text-muted-foreground">{q?.type === "EQUITY" ? "Stock" : q?.type === "ETF" ? `ETF · ${CLASS_LABEL[classify(s)]}` : q?.type ?? ""}</td>
                    <td className="r">{q?.price != null ? usd(q.price, 2) : "…"}</td>
                    <td className={`r ${tone(day)}`}>{pct(day, 2, true)}</td>
                    <td className={`r ${tone(change(series, 21))}`}>{pct(change(series, 21), 1, true)}</td>
                    <td className={`r ${tone(change(series, 63))}`}>{pct(change(series, 63), 1, true)}</td>
                    <td className={`r ${tone(ytd)}`}>{pct(ytd, 1, true)}</td>
                    <td className={`r ${tone(change(series, 250))}`}>{pct(change(series, 250), 1, true)}</td>
                    <td><Spark data={series.filter((x): x is number => x != null).filter((_, i) => i % 3 === 0)} /></td>
                    <td className="text-right"><button onClick={() => actions.setWatch(watch.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="opacity-40 hover:opacity-100"><X className="size-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Treasury yields" sub="Par yields from the U.S. Treasury; changes in basis points" className="mt-4">
        {!curve ? <Loading label="Loading yields" /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tenors.map(([label, i]) => {
              const now = curve.latest?.yields[i], m = curve.monthAgo?.yields[i], y = curve.yearAgo?.yields[i];
              return (
                <div key={label} className="rounded-lg border border-border bg-subtle p-4">
                  <div className="eyebrow">{label} Treasury</div>
                  <div className="num mt-1 text-[24px] font-semibold">{now != null ? `${now.toFixed(2)}%` : "—"}</div>
                  <div className="num mt-1 text-[12px] text-muted-foreground">
                    {now != null && m != null && <span className={tone(now - m)}>{now - m >= 0 ? "+" : ""}{Math.round((now - m) * 100)} bp 1 mo</span>}
                    {now != null && y != null && <span className="ml-3">{now - y >= 0 ? "+" : ""}{Math.round((now - y) * 100)} bp 1 yr</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
