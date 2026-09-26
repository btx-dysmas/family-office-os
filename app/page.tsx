"use client";
import { CalendarDays, Cake, CircleAlert, ListTodo } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Dot, Loading, Panel, PageHeader, Pill, Ring, Stat } from "@/components/kit";
import Plot from "@/components/Plot";
import { analyze, type Prices } from "@/lib/analytics";
import { donut, yieldCurve } from "@/lib/charts";
import { CLASS_COLOR, CLASS_LABEL, CLASSES, portfolioStats, zeroWeights } from "@/lib/cma";
import { holdingSymbols, useApi, useMacro, useQuotes } from "@/lib/data";
import { date, daysUntil, money, nextBirthday, pct, sum, today, tone } from "@/lib/format";
import { value } from "@/lib/household";
import { compliance } from "@/lib/ips";
import { buildPlan, simulate } from "@/lib/montecarlo";
import { classify, REGIME_COLOR } from "@/lib/regime";
import { useBook } from "@/lib/store";

export default function Dashboard() {
  const { households } = useBook();
  const symbols = useMemo(() => holdingSymbols(households), [households]);
  const quotes = useQuotes(symbols);
  const key = [...new Set(symbols.filter((s) => s !== "$CASH"))].sort().slice(0, 40).join(",");
  const { data: prices } = useApi<Prices>(key ? `/api/prices?range=1y&symbols=${key}` : null);
  const { data: macro } = useMacro();
  const rf = (macro?.rates.tbill ?? 4) / 100;

  const rows = useMemo(() => households.map((h) => {
    const v = value(h, quotes);
    const mc = simulate(buildPlan(h, v), 2000);
    const checks = compliance(h, v);
    const a = prices ? analyze(v, prices, 252, rf) : null;
    return { h, v, mc, breaches: checks.filter((c) => c.status === "Breach").length, watch: checks.filter((c) => c.status === "Watch").length, stats: portfolioStats(v.policyWeights), oneYear: a?.port.total ?? null };
  }), [households, quotes, prices, rf]);

  const totals = {
    netWorth: sum(rows.map((r) => r.v.netWorth)), policy: sum(rows.map((r) => r.v.policy)), liquid: sum(rows.map((r) => r.v.liquid)),
    cash: sum(rows.map((r) => r.v.cash)), day: sum(rows.map((r) => r.v.day)),
  };
  const weighted = (f: (r: (typeof rows)[number]) => number | null) => {
    const xs = rows.filter((r) => f(r) != null);
    const w = sum(xs.map((r) => r.v.policy));
    return w ? sum(xs.map((r) => f(r)! * r.v.policy)) / w : null;
  };
  const book = zeroWeights();
  rows.forEach((r) => CLASSES.forEach((c) => (book[c] += (r.v.policyWeights[c] * r.v.policy) / (totals.policy || 1))));
  const reading = macro?.available ? classify(macro.series, today()) : null;
  const s = macro?.series;

  const alerts = rows.flatMap((r) => [
    ...(r.breaches ? [{ icon: CircleAlert, tone: "neg", text: `${r.breaches} IPS ${r.breaches === 1 ? "breach" : "breaches"}`, who: r.h, href: `/households/${r.h.id}/policy` }] : []),
    ...r.h.tasks.filter((t) => !t.done && daysUntil(t.due) <= 21).map((t) => ({ icon: ListTodo, tone: daysUntil(t.due) < 0 ? "neg" : "warn", text: `${t.title} · due ${date(t.due)}`, who: r.h, href: `/households/${r.h.id}/relationship` })),
    ...r.h.people.filter((p) => nextBirthday(p.dob) <= 30).map((p) => ({ icon: Cake, tone: "info", text: `${p.name}'s birthday in ${nextBirthday(p.dob)} days`, who: r.h, href: `/households/${r.h.id}/relationship` })),
    ...(r.h.nextMeeting && daysUntil(r.h.nextMeeting) <= 30 && daysUntil(r.h.nextMeeting) >= 0 ? [{ icon: CalendarDays, tone: "info", text: `Review meeting ${date(r.h.nextMeeting)}`, who: r.h, href: `/households/${r.h.id}/meeting` }] : []),
  ]);

  return (
    <>
      <PageHeader eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} title="Advisor dashboard"
        sub={`${households.length} client households. Positions are valued at live prices; plans rerun with every change.`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Household net worth" value={money(totals.netWorth)} sub={`Across ${households.length} families, including real estate and private assets`} />
        <Stat label="Assets under advisement" value={money(totals.policy)} sub={<span className={tone(totals.day)}>{totals.day >= 0 ? "+" : ""}{money(totals.day)} today</span>} />
        <Stat label="Cash balances" value={money(totals.cash)} sub={`${pct(totals.cash / (totals.liquid || 1))} of liquid assets`} />
        <Stat label="Average retirement probability" value={pct(weighted((r) => r.mc.success), 0)} sub="Asset-weighted, 2,000 simulations per household" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Households" sub="Portfolio figures cover accounts managed under each family's investment policy" pad={false}>
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead><tr><th>Household</th><th className="r">Net worth</th><th className="r">Invested</th><th className="r">Cash</th><th className="r">1-yr return</th><th className="r">Exp. volatility</th><th>Retirement</th><th>Policy</th><th>Next meeting</th></tr></thead>
              <tbody>
                {rows.map(({ h, v, mc, breaches, watch, stats, oneYear }) => (
                  <tr key={h.id}>
                    <td><Link href={`/households/${h.id}`} className="font-medium hover:text-gold">{h.name}</Link><div className="text-[11.5px] text-muted-foreground">{h.tier} · {h.state}</div></td>
                    <td className="r">{money(v.netWorth)}</td>
                    <td className="r">{money(v.policy)}</td>
                    <td className="r">{money(v.cash)}</td>
                    <td className={`r ${tone(oneYear)}`}>{oneYear == null ? "…" : pct(oneYear, 1, true)}</td>
                    <td className="r">{pct(stats.vol)}</td>
                    <td><div className="flex items-center gap-2"><Ring value={mc.success} size={34} /></div></td>
                    <td>{breaches ? <Pill kind="Breach">{breaches} breach{breaches > 1 ? "es" : ""}</Pill> : watch ? <Pill kind="Watch">{watch} to watch</Pill> : <Pill kind="Compliant">Compliant</Pill>}</td>
                    <td className="text-muted-foreground">{h.nextMeeting ? date(h.nextMeeting) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Needs attention" sub={`${alerts.length} items across the book`}>
          <ul className="space-y-1">
            {alerts.slice(0, 12).map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="flex gap-3 rounded-md px-2 py-2 hover:bg-raised">
                  <a.icon className={`mt-0.5 size-4 shrink-0 ${a.tone === "neg" ? "text-neg" : a.tone === "warn" ? "text-warn" : "text-c1"}`} />
                  <span className="min-w-0 text-[13px]"><span className="block truncate">{a.text}</span><span className="text-[11.5px] text-muted-foreground">{a.who.name}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Book allocation" sub="All policy portfolios combined">
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Plot fig={donut(CLASSES.map((c) => CLASS_LABEL[c]), CLASSES.map((c) => book[c]), CLASSES.map((c) => CLASS_COLOR[c]), money(totals.policy))} height={160} />
            <ul className="space-y-1.5 text-[13px]">
              {CLASSES.map((c) => <li key={c} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Dot color={CLASS_COLOR[c]} />{CLASS_LABEL[c]}</span><span className="num text-muted-foreground">{pct(book[c])}</span></li>)}
            </ul>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-[13px]">
            <div><div className="eyebrow">Expected return</div><div className="num mt-1 text-[18px] font-semibold">{pct(weighted((r) => r.stats.mean))}</div></div>
            <div><div className="eyebrow">Expected volatility</div><div className="num mt-1 text-[18px] font-semibold">{pct(weighted((r) => r.stats.vol))}</div></div>
          </div>
        </Panel>

        <Panel title="Economic regime" sub="Rules-based, from FRED data" action={<Link href="/markets" className="text-[12px] text-gold hover:underline">Details</Link>}>
          {!macro ? <Loading label="Loading FRED data" /> : !reading ? <p className="text-[13px] text-muted-foreground">FRED data unavailable. Add FRED_API_KEY to enable.</p> : (
            <>
              <div className="flex items-center gap-3">
                <span className="rounded-md px-2.5 py-1 text-[15px] font-semibold text-background" style={{ background: REGIME_COLOR[reading.regime] }}>{reading.regime}</span>
                <span className="text-[12.5px] text-muted-foreground">{reading.reasons[0]}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {([["CPI inflation", s?.CPIAUCSL], ["Fed funds rate", s?.DFF], ["10-year Treasury", s?.DGS10], ["Unemployment", s?.UNRATE]] as const).map(([l, x]) => (
                  <div key={l} className="rounded-md border border-border bg-subtle px-3 py-2.5">
                    <div className="eyebrow">{l}</div>
                    <div className="num mt-1 text-[18px] font-semibold">{x?.latest ? `${x.latest[1].toFixed(2)}%` : "—"}</div>
                    <div className="num text-[11px] text-muted-foreground">{x?.chg1y != null ? `${x.chg1y >= 0 ? "+" : ""}${x.chg1y.toFixed(2)} pts vs 1 yr` : ""}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Treasury yield curve" sub="Daily par yields, U.S. Treasury">
          {macro?.curve ? <Plot fig={yieldCurve(macro.curve)} height={250} /> : <Loading label="Loading yield curve" />}
        </Panel>
      </div>
    </>
  );
}
