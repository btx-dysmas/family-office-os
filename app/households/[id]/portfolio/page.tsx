"use client";
import { useMemo, useState } from "react";
import { Dot, KV, Loading, Note, Panel, Pill, Segmented } from "@/components/kit";
import Plot from "@/components/Plot";
import { Button } from "@/components/ui/button";
import { analyze, type Prices } from "@/lib/analytics";
import { C, donut, growth, hbars, pctLines } from "@/lib/charts";
import { band, CLASS_COLOR, CLASS_LABEL, CLASSES, MODEL, portfolioStats, riskContribution, type Weights } from "@/lib/cma";
import { useApi } from "@/lib/data";
import { money, num, pct, sum, tone, usd } from "@/lib/format";
import { targetWeights } from "@/lib/household";
import { useHH } from "@/lib/household-context";
import { useLookThrough } from "@/lib/use-lookthrough";

const RANGES: [number, string][] = [[252, "1Y"], [756, "3Y"], [1260, "5Y"]];

function Builder() {
  const { h, v, macro, update } = useHH();
  const [w, setW] = useState<Weights>(() => targetWeights(h));
  const total = sum(Object.values(w));
  const norm = Object.fromEntries(CLASSES.map((c) => [c, total ? w[c] / total : 0])) as Weights;
  const s = portfolioStats(norm), cur = portfolioStats(v.policyWeights), rc = riskContribution(norm);
  const rf = (macro?.rates.tbill ?? 4) / 100;
  const presets: [string, Weights][] = [["Current", v.policyWeights], ["IPS target", targetWeights(h)], ["Conservative", MODEL.Conservative], ["Moderate", MODEL.Moderate], ["Aggressive", MODEL.Aggressive]];

  return (
    <Panel title="Portfolio builder" sub="Design a mix and see its expected return, risk and Sharpe ratio from the capital market assumptions"
      action={<Button size="sm" variant="outline" disabled={Math.abs(total - 1) > 0.001} onClick={() => update((x) => ({ ...x, ips: { ...x.ips, targets: CLASSES.map((c) => ({ cls: c, target: +norm[c].toFixed(3), min: Math.max(0, +(norm[c] - band(norm[c])).toFixed(3)), max: +(norm[c] + band(norm[c])).toFixed(3) })) } }))}>Adopt as IPS targets</Button>}>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {presets.map(([l, p]) => <Button key={l} size="xs" variant="secondary" onClick={() => setW({ ...p })}>{l}</Button>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)]">
        <div className="space-y-3">
          {CLASSES.map((c) => (
            <div key={c}>
              <div className="flex justify-between text-[12.5px]"><span className="flex items-center gap-2"><Dot color={CLASS_COLOR[c]} />{CLASS_LABEL[c]}</span><span className="num">{pct(w[c], 0)}</span></div>
              <input type="range" min={0} max={100} step={1} value={Math.round(w[c] * 100)} onChange={(e) => setW({ ...w, [c]: +e.target.value / 100 })} className="mt-1 w-full accent-[var(--gold)]" aria-label={CLASS_LABEL[c]} />
            </div>
          ))}
          <div className={`text-[12px] ${Math.abs(total - 1) > 0.001 ? "text-warn" : "text-muted-foreground"}`}>Total {pct(total, 0)}{Math.abs(total - 1) > 0.001 ? ", shown rescaled to 100%" : ""}</div>
        </div>
        <Plot fig={donut(CLASSES.map((c) => CLASS_LABEL[c]), CLASSES.map((c) => norm[c]), CLASSES.map((c) => CLASS_COLOR[c]))} height={200} />
        <div>
          <table className="grid-table">
            <thead><tr><th /><th className="r">Proposed</th><th className="r">Current</th></tr></thead>
            <tbody>
              <tr><td>Expected return</td><td className="r font-semibold">{pct(s.mean)}</td><td className="r text-muted-foreground">{pct(cur.mean)}</td></tr>
              <tr><td>After {pct(h.ips.advisoryFee, 2)} fee</td><td className="r font-semibold">{pct(s.mean - h.ips.advisoryFee)}</td><td className="r text-muted-foreground">{pct(cur.mean - h.ips.advisoryFee)}</td></tr>
              <tr><td>Volatility</td><td className={`r font-semibold ${s.vol > h.ips.limits.maxVolatility ? "text-neg" : ""}`}>{pct(s.vol)}</td><td className="r text-muted-foreground">{pct(cur.vol)}</td></tr>
              <tr><td>Sharpe ratio</td><td className="r font-semibold">{num((s.mean - rf) / s.vol)}</td><td className="r text-muted-foreground">{num((cur.mean - rf) / cur.vol)}</td></tr>
            </tbody>
          </table>
          <div className="mt-3 text-[11.5px] text-muted-foreground">Share of risk</div>
          <div className="mt-1 flex h-2.5 overflow-hidden rounded-full">{CLASSES.map((c) => <span key={c} style={{ width: `${Math.max(0, rc[c]) * 100}%`, background: CLASS_COLOR[c] }} title={`${CLASS_LABEL[c]} ${pct(rc[c])}`} />)}</div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">Equities carry {pct(rc.us + rc.intl, 0)} of the risk with {pct(norm.us + norm.intl, 0)} of the money. Sharpe uses the 3-month T-bill ({pct(rf, 2)}).</p>
        </div>
      </div>
    </Panel>
  );
}

export default function Portfolio() {
  const { h, v, macro } = useHH();
  const [days, setDays] = useState(756);
  const symbols = [...new Set(v.positions.map((p) => p.symbol).filter((s) => s !== "$CASH"))].sort().join(",");
  const { data: prices, error } = useApi<Prices>(`/api/prices?range=5y&symbols=${symbols}`);
  const rf = (macro?.rates.tbill ?? 4) / 100;
  const a = useMemo(() => (prices ? analyze(v, prices, days, rf) : null), [prices, v, days, rf]);
  const lt = useLookThrough(v);
  const accounts = v.accounts.filter((x) => x.inPolicy);

  return (
    <div className="space-y-4">
      <Panel title="Holdings" sub={`${v.positions.filter((p) => p.account.inPolicy).length} positions in ${accounts.length} policy accounts · ${money(v.policy)}`} pad={false}>
        <div className="overflow-x-auto">
          <table className="grid-table">
            <thead><tr><th>Security</th><th>Asset class</th><th className="r">Shares</th><th className="r">Price</th><th className="r">Market value</th><th className="r">Cost basis</th><th className="r">Unrealized</th><th className="r">Weight</th><th className="r">Expense</th></tr></thead>
            <tbody>
              {accounts.map((acc) => {
                const ps = v.positions.filter((p) => p.account.id === acc.id);
                return [
                  <tr key={acc.id} className="bg-subtle"><td colSpan={9} className="!py-2 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">{acc.name} · {acc.custodian} · {acc.tax.replace("-", " ")}<span className="num float-right normal-case">{usd(sum(ps.map((p) => p.value)))}</span></td></tr>,
                  ...ps.map((p) => (
                    <tr key={acc.id + p.symbol}>
                      <td><span className="font-medium">{p.symbol === "$CASH" ? "Cash" : p.symbol}</span> <span className="text-muted-foreground">{p.symbol === "$CASH" ? "" : lt.funds[p.symbol]?.name ?? p.name}</span></td>
                      <td><span className="flex items-center gap-2 text-muted-foreground"><Dot color={CLASS_COLOR[p.cls]} />{CLASS_LABEL[p.cls]}</span></td>
                      <td className="r">{p.symbol === "$CASH" ? "" : num(p.shares, p.shares < 100 ? 2 : 0)}</td>
                      <td className="r">{p.symbol === "$CASH" ? "" : usd(p.price, 2)}</td>
                      <td className="r">{usd(p.value)}</td>
                      <td className="r text-muted-foreground">{usd(p.basis)}</td>
                      <td className={`r ${tone(p.gain)}`}>{p.symbol === "$CASH" ? "" : `${p.gain >= 0 ? "+" : ""}${money(p.gain)}`}</td>
                      <td className="r">{pct(p.value / v.policy)}</td>
                      <td className="r text-muted-foreground">{lt.funds[p.symbol]?.expense != null ? pct(lt.funds[p.symbol].expense, 2) : ""}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium">Performance and risk <span className="text-[12px] text-muted-foreground">current holdings at today&apos;s weights, rebalanced daily</span></h2>
        <Segmented value={days} options={RANGES} onChange={setDays} />
      </div>
      {error && <Panel><p className="text-[13px] text-neg">{error}</p></Panel>}
      {!a && !error && <Panel><Loading label="Loading price history" /></Panel>}
      {a && (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Panel title="Growth of $10,000" sub={`Portfolio ${money(a.port.growth.at(-1)! * 10000)} vs S&P 500 ${money(a.bench.growth.at(-1)! * 10000)}`}>
              <Plot fig={growth(a.dates, [{ name: "Portfolio", y: a.port.growth.map((x) => x * 10000), color: C.gold }, { name: "S&P 500", y: a.bench.growth.map((x) => x * 10000), color: C.ink3, dash: "dot" }])} height={300} />
            </Panel>
            <Panel title="Risk and return" sub={`${a.years.toFixed(1)} years of daily data`}>
              <table className="grid-table">
                <thead><tr><th /><th className="r">Portfolio</th><th className="r">S&amp;P 500</th></tr></thead>
                <tbody>
                  {([
                    ["Total return", pct(a.port.total), pct(a.bench.total)], ["CAGR", pct(a.port.cagr), pct(a.bench.cagr)],
                    ["Standard deviation", pct(a.port.vol), pct(a.bench.vol)], ["Downside deviation", pct(a.port.downside), pct(a.bench.downside)],
                    ["Maximum drawdown", pct(a.port.maxDD), pct(a.bench.maxDD)], ["Beta", num(a.port.beta), "1.00"],
                    ["Sharpe ratio", num(a.port.sharpe), num(a.bench.sharpe)], ["Sortino ratio", num(a.port.sortino), num(a.bench.sortino)],
                  ] as const).map(([k, x, y]) => <tr key={k}><td>{k}</td><td className="r font-semibold">{x}</td><td className="r text-muted-foreground">{y}</td></tr>)}
                </tbody>
              </table>
              {a.covered < 0.995 && <Note>{pct(1 - a.covered)} of the portfolio lacks price history and is excluded.</Note>}
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Drawdown" sub="Decline from the previous peak">
              <Plot fig={pctLines(a.dates, [{ name: "Portfolio", y: a.port.drawdown, color: C.c4, fill: true }, { name: "S&P 500", y: a.bench.drawdown, color: C.ink3, dash: "dot" }])} height={250} />
            </Panel>
            <Panel title="Rolling 12-month return">
              {a.rolling.length ? <Plot fig={pctLines(a.rolling.map((r) => r.date), [{ name: "Portfolio", y: a.rolling.map((r) => r.port), color: C.c1 }, { name: "S&P 500", y: a.rolling.map((r) => r.bench), color: C.ink3, dash: "dot" }])} height={250} /> : <p className="text-[13px] text-muted-foreground">Needs more than a year of history. Choose 3Y or 5Y.</p>}
            </Panel>
          </div>
          <Panel title="Contribution" sub="Performance contribution = weight × annualized return. Risk contribution = share of portfolio variance." pad={false}>
            <div className="overflow-x-auto">
              <table className="grid-table">
                <thead><tr><th>Holding</th><th>Asset class</th><th className="r">Weight</th><th className="r">Annualized return</th><th className="r">Volatility</th><th className="r">Beta</th><th className="r">Return contribution</th><th className="r">Risk contribution</th></tr></thead>
                <tbody>
                  {a.contributions.map((c) => (
                    <tr key={c.symbol}>
                      <td className="font-medium">{c.symbol === "$CASH" ? "Cash" : c.symbol}</td>
                      <td className="text-muted-foreground">{CLASS_LABEL[c.cls]}</td>
                      <td className="r">{pct(c.weight)}</td><td className={`r ${tone(c.cagr)}`}>{pct(c.cagr)}</td><td className="r">{pct(c.vol)}</td><td className="r">{num(c.beta)}</td>
                      <td className={`r ${tone(c.contribution)}`}>{pct(c.contribution, 2)}</td>
                      <td className={`r ${c.risk > c.weight * 1.6 ? "font-semibold text-warn" : ""}`}>{pct(c.risk)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Sector exposure" sub="Looking through funds to their holdings (Yahoo Finance fund data)">
          {lt.sectors.length ? <Plot fig={hbars(lt.sectors.slice(0, 11).map((s) => s.sector), lt.sectors.slice(0, 11).map((s) => s.ofEquity), C.c2)} height={300} /> : <Loading label="Loading fund profiles" />}
          <Note>Shares of equity exposure. Stocks use their own sector; funds use their reported sector weights.</Note>
        </Panel>
        <Panel title="Largest underlying positions" sub="Direct holdings plus each fund's top ten, weighted by position size">
          {lt.top.length ? (
            <KV rows={lt.top.map((t) => [<span key={t.symbol}><span className="font-medium text-foreground">{t.symbol}</span> <span className="text-muted-foreground">{t.name}</span></span>, <span key="w" className={t.weight > h.ips.limits.maxPosition ? "text-neg" : ""}>{pct(t.weight, 2)}</span>])} />
          ) : <Loading label="Loading fund holdings" />}
          {lt.top[0] && lt.top[0].weight > h.ips.limits.maxPosition && <div className="mt-2"><Pill kind="Breach">Look-through concentration above the {pct(h.ips.limits.maxPosition, 0)} limit</Pill></div>}
        </Panel>
      </div>

      <Builder />
    </div>
  );
}
