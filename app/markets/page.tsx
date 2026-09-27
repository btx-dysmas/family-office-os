"use client";
import { useMemo } from "react";
import { KV, Loading, Note, PageHeader, Panel } from "@/components/kit";
import Plot from "@/components/Plot";
import { C, macroLines, yieldCurve } from "@/lib/charts";
import { useMacro } from "@/lib/data";
import { today } from "@/lib/format";
import { classify, history, IMPLICATIONS, REGIME_COLOR, type Regime } from "@/lib/regime";

/** 12-month sparkline for an indicator row. */
function Trend({ values }: { values: number[] }) {
  if (values.length < 4) return null;
  const w = 90, h = 20, lo = Math.min(...values), hi = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} aria-hidden="true"><polyline fill="none" stroke="var(--c1)" strokeWidth={1.3} points={pts} /></svg>;
}

export default function Markets() {
  const { data: m, error } = useMacro();
  const s = useMemo(() => m?.series ?? {}, [m]);
  const now = useMemo(() => (m?.available ? classify(s, today()) : null), [m, s]);
  const past = useMemo(() => (m?.available ? history(s) : []), [m, s]);
  const imp = now ? IMPLICATIONS[now.regime] : null;
  // How long the current classification has held, from the quarterly history.
  const since = useMemo(() => {
    if (!past.length) return null;
    const cur = past[past.length - 1].regime;
    let k = past.length - 1;
    while (k > 0 && past[k - 1].regime === cur) k--;
    return new Date(past[k].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [past]);
  const INDICATORS: [string, string, string][] = [
    ["CPIAUCSL", "CPI inflation", "y/y"], ["A191RL1Q225SBEA", "Real GDP growth", "annualized"], ["UNRATE", "Unemployment", ""],
    ["DFF", "Fed funds", "effective"], ["DGS10", "10-year Treasury", ""], ["MORTGAGE30US", "30-year mortgage", "Freddie Mac"],
  ];
  const fredError = Object.values(s).find((x) => x.error)?.error;

  return (
    <>
      <PageHeader eyebrow="Markets" title="Economic regime" sub="Growth, inflation, labor and the yield curve from FRED and the U.S. Treasury, classified by explicit rules and translated into portfolio implications." />
      {!m && !error && <Loading label="Loading FRED series and the Treasury yield curve" />}
      {(error || (m && !m.available)) && <Panel title="Economic data unavailable"><p className="text-[13px] text-muted-foreground">{m && !m.keyConfigured ? "Set FRED_API_KEY in .env.local or the Vercel project settings. Keys are free at fred.stlouisfed.org." : error ?? fredError ?? "FRED did not respond. Try again shortly."}</p></Panel>}
      {now && imp && (
        <>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Panel title="Current regime" sub="Rules-based, updated as each FRED series is published">
              <div className="flex items-baseline gap-3">
                <span className="size-2.5 translate-y-[-2px] rounded-full" style={{ background: REGIME_COLOR[now.regime] }} />
                <span className="font-serif text-[24px] leading-none">{now.regime}</span>
                {since && <span className="text-[12.5px] text-muted-foreground">since {since}</span>}
              </div>
              <p className="mt-3 max-w-[58ch] text-[13.5px] leading-relaxed text-muted-foreground">{imp.summary}</p>
              <div className="eyebrow mt-5 mb-1.5">Signals</div>
              <ul className="space-y-1 text-[13px] leading-relaxed">{now.reasons.map((r) => <li key={r} className="flex gap-2"><span className="text-muted-foreground">–</span>{r.charAt(0).toUpperCase() + r.slice(1)}</li>)}</ul>
              <KV className="mt-4" rows={[
                ["Real GDP growth, annualized", now.gdp != null ? `${now.gdp.toFixed(1)}%` : "—"], ["CPI inflation, y/y", now.cpi != null ? `${now.cpi.toFixed(1)}%` : "—"],
                ["Unemployment", now.unemp != null ? `${now.unemp.toFixed(1)}%` : "—"], ["Sahm rule reading", now.sahm != null ? <span key="s">{now.sahm >= 0 ? "+" : ""}{now.sahm.toFixed(2)} pts <span className="text-muted-foreground">(recession at 0.50)</span></span> : "—"],
                ["10-year less 2-year", now.curve != null ? `${now.curve.toFixed(2)} pts${now.curve < 0 ? " (inverted)" : ""}` : "—"],
              ]} />
            </Panel>
            <Panel title="Portfolio implications" sub={`Typical positioning in ${now.regime.toLowerCase()}`}>
              <dl className="divide-y divide-border/70 text-[13px]">
                {([["Equities", imp.equities], ["Bonds", imp.bonds], ["Real assets", imp.real], ["Cash", imp.cash]] as const).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[96px_1fr] gap-3 py-2.5"><dt className="font-medium">{k}</dt><dd className="leading-relaxed text-muted-foreground">{v}</dd></div>
                ))}
              </dl>
              <details className="group mt-4 text-[12.5px]">
                <summary className="cursor-pointer text-gold select-none hover:underline">How each regime is defined</summary>
                <ul className="mt-3 space-y-2.5">
                  {(Object.keys(IMPLICATIONS) as Regime[]).map((r) => <li key={r} className="grid grid-cols-[14px_1fr] gap-1.5 leading-relaxed"><span className="mt-1.5 size-2 rounded-full" style={{ background: REGIME_COLOR[r] }} /><span><span className="font-medium">{r}.</span> <span className="text-muted-foreground">{IMPLICATIONS[r].summary}</span></span></li>)}
                </ul>
              </details>
            </Panel>
          </div>

          <Panel title="Regime history" sub="Quarter-end classification since 2008 using the same rules" className="mt-4">
            <div className="flex h-8 overflow-hidden rounded-md" role="img" aria-label="Regime by quarter">
              {past.map((r) => <span key={r.date} className="flex-1" style={{ background: REGIME_COLOR[r.regime] }} title={`${r.date.slice(0, 7)}: ${r.regime}`} />)}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">{past.filter((_, i) => i % 8 === 0).map((r) => <span key={r.date}>{r.date.slice(0, 4)}</span>)}</div>
            <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted-foreground">{(Object.keys(REGIME_COLOR) as Regime[]).map((r) => <span key={r} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: REGIME_COLOR[r] }} />{r}</span>)}</div>
          </Panel>
        </>
      )}
      {m?.available && (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Panel title="Indicators" sub="Latest FRED readings" pad={false}>
              <table className="grid-table">
                <thead><tr><th>Series</th><th className="r">Latest</th><th className="r">1-yr chg</th><th>12 months</th><th className="r">As of</th></tr></thead>
                <tbody>
                  {INDICATORS.map(([id, label, note]) => {
                    const x = s[id], from = x?.latest ? `${Number(x.latest[0].slice(0, 4)) - 1}${x.latest[0].slice(4)}` : "", pts = (x?.obs ?? []).filter((o) => o[0] >= from).map((o) => o[1]);
                    return (
                      <tr key={id}>
                        <td>{label}{note && <span className="ml-1.5 text-[11.5px] text-muted-foreground">{note}</span>}</td>
                        <td className="r font-medium">{x?.latest ? `${x.latest[1].toFixed(2)}%` : "—"}</td>
                        <td className="r text-muted-foreground">{x?.chg1y != null ? `${x.chg1y >= 0 ? "+" : ""}${x.chg1y.toFixed(2)}` : "—"}</td>
                        <td><Trend values={pts} /></td>
                        <td className="r text-[12px] whitespace-nowrap text-muted-foreground">{x?.latest ? new Date(x.latest[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
            <Panel title="Treasury yield curve" sub="Daily par yields, U.S. Department of the Treasury">{m.curve && <Plot fig={yieldCurve(m.curve)} height={270} />}</Panel>
          </div>
          <div className="mt-4">
            <Panel title="Policy and market rates"><Plot fig={macroLines(s, [["DFF", "Fed funds", C.c3], ["DGS2", "2-year", C.c2], ["DGS10", "10-year", C.c1], ["MORTGAGE30US", "30-year mortgage", C.c5]])} height={260} /></Panel>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Panel title="Growth and inflation"><Plot fig={macroLines(s, [["A191RL1Q225SBEA", "Real GDP growth", C.c1], ["CPIAUCSL", "CPI inflation", C.c4], ["UNRATE", "Unemployment", C.c2]])} height={260} /></Panel>
            <Panel title="Credit spread" sub="Baa corporate yield less 10-year Treasury"><Plot fig={macroLines(s, [["BAA10Y", "Baa spread", C.c3]], " pts")} height={260} /></Panel>
            <Panel title="Equity volatility" sub="CBOE VIX"><Plot fig={macroLines(s, [["VIXCLS", "VIX", C.c5]], "")} height={260} /></Panel>
          </div>
          <Note>Regime rules: Stagflation when CPI is above 3.5% with weak growth (GDP under 1% or the Sahm reading at 0.3 or more); Recession when real GDP contracts or the Sahm rule triggers; Recovery when growth is positive and unemployment is elevated but falling; Expansion when GDP grows at least 1.5%; otherwise Late cycle.</Note>
        </>
      )}
    </>
  );
}
