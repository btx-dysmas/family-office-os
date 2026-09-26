"use client";
import { useMemo } from "react";
import { KV, Loading, Note, PageHeader, Panel, Stat } from "@/components/kit";
import Plot from "@/components/Plot";
import { C, macroLines, yieldCurve } from "@/lib/charts";
import { useMacro } from "@/lib/data";
import { date, today } from "@/lib/format";
import { classify, history, IMPLICATIONS, REGIME_COLOR, type Regime } from "@/lib/regime";

export default function Markets() {
  const { data: m, error } = useMacro();
  const s = useMemo(() => m?.series ?? {}, [m]);
  const now = useMemo(() => (m?.available ? classify(s, today()) : null), [m, s]);
  const past = useMemo(() => (m?.available ? history(s) : []), [m, s]);
  const imp = now ? IMPLICATIONS[now.regime] : null;
  const kpi = (id: string, label: string) => {
    const x = s[id];
    return <Stat key={id} label={label} value={x?.latest ? `${x.latest[1].toFixed(2)}%` : "—"} sub={x?.latest ? `${x.chg1y != null ? `${x.chg1y >= 0 ? "+" : ""}${x.chg1y.toFixed(2)} pts vs 1 yr · ` : ""}${date(x.latest[0])}` : undefined} />;
  };
  const fredError = Object.values(s).find((x) => x.error)?.error;

  return (
    <>
      <PageHeader eyebrow="Markets" title="Economic regime" sub="Growth, inflation, labor and the yield curve from FRED and the U.S. Treasury, classified by explicit rules and translated into portfolio implications." />
      {!m && !error && <Loading label="Loading FRED series and the Treasury yield curve" />}
      {(error || (m && !m.available)) && <Panel title="Economic data unavailable"><p className="text-[13px] text-muted-foreground">{m && !m.keyConfigured ? "Set FRED_API_KEY in .env.local or the Vercel project settings. Keys are free at fred.stlouisfed.org." : error ?? fredError ?? "FRED did not respond. Try again shortly."}</p></Panel>}
      {now && imp && (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel title="Current regime" sub="Rules-based classification, updated as each series is published">
              <div className="flex flex-wrap items-center gap-4">
                <span className="rounded-lg px-4 py-2 font-serif text-[30px] leading-none text-background" style={{ background: REGIME_COLOR[now.regime] }}>{now.regime}</span>
                <p className="max-w-md text-[13.5px] text-muted-foreground">{imp.summary}</p>
              </div>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px]">{now.reasons.map((r) => <li key={r}>{r.charAt(0).toUpperCase() + r.slice(1)}.</li>)}</ul>
              <KV className="mt-4" rows={[
                ["Real GDP growth (annualized)", now.gdp != null ? `${now.gdp.toFixed(1)}%` : "—"], ["CPI inflation (year over year)", now.cpi != null ? `${now.cpi.toFixed(1)}%` : "—"],
                ["Unemployment", now.unemp != null ? `${now.unemp.toFixed(1)}%` : "—"], ["Sahm rule reading", now.sahm != null ? `${now.sahm >= 0 ? "+" : ""}${now.sahm.toFixed(2)} pts (0.50 signals recession)` : "—"],
                ["10-year less 2-year Treasury", now.curve != null ? `${now.curve.toFixed(2)} pts${now.curve < 0 ? " (inverted)" : ""}` : "—"],
              ]} />
            </Panel>
            <Panel title="What it means for portfolios" sub={`Typical positioning in ${now.regime.toLowerCase()}`}>
              <table className="grid-table">
                <tbody>
                  {([["Equities", imp.equities], ["Bonds", imp.bonds], ["Real assets", imp.real], ["Cash", imp.cash]] as const).map(([k, v]) => <tr key={k}><td className="w-28 font-medium">{k}</td><td className="text-muted-foreground">{v}</td></tr>)}
                </tbody>
              </table>
              <div className="mt-5 eyebrow">All regimes</div>
              <ul className="mt-2 space-y-2 text-[12.5px]">
                {(Object.keys(IMPLICATIONS) as Regime[]).map((r) => <li key={r} className="flex gap-2.5"><span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: REGIME_COLOR[r] }} /><span><b className="font-medium">{r}.</b> <span className="text-muted-foreground">{IMPLICATIONS[r].summary}</span></span></li>)}
              </ul>
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
          <div className="mt-4 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {kpi("CPIAUCSL", "CPI inflation")}{kpi("A191RL1Q225SBEA", "Real GDP growth")}{kpi("UNRATE", "Unemployment")}
            {kpi("DFF", "Fed funds")}{kpi("DGS10", "10-year Treasury")}{kpi("MORTGAGE30US", "30-year mortgage")}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel title="Treasury yield curve" sub="Daily par yields, U.S. Department of the Treasury">{m.curve && <Plot fig={yieldCurve(m.curve)} height={290} />}</Panel>
            <Panel title="Policy and market rates"><Plot fig={macroLines(s, [["DFF", "Fed funds", C.c3], ["DGS2", "2-year", C.c2], ["DGS10", "10-year", C.c1], ["MORTGAGE30US", "30-year mortgage", C.c5]])} height={290} /></Panel>
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
