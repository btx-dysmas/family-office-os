"use client";
import { CalendarDays, Cake, CircleAlert, ListTodo } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Dot, Loading, Panel, PageHeader, Pill } from "@/components/kit";
import { EmptyBook } from "@/components/widgets";
import Plot from "@/components/Plot";
import { analyze, type Prices } from "@/lib/analytics";
import { yieldCurve } from "@/lib/charts";
import { CLASS_COLOR, CLASS_LABEL, CLASSES, portfolioStats, zeroWeights } from "@/lib/cma";
import { holdingSymbols, useApi, useMacro, useQuotesAt } from "@/lib/data";
import { attention } from "@/lib/attention";
import { harvest } from "@/lib/ips";
import { ago, date, daysUntil, money, nextBirthday, pct, prob, sum, today, tone } from "@/lib/format";
import { value } from "@/lib/household";
import { compliance } from "@/lib/ips";
import { buildPlan, simulate } from "@/lib/montecarlo";
import { classify, REGIME_COLOR } from "@/lib/regime";
import { useBook } from "@/lib/store";

export default function Dashboard() {
  const { households } = useBook();
  const symbols = useMemo(() => holdingSymbols(households), [households]);
  const { quotes, at: quotesAt } = useQuotesAt(symbols);
  const key = [...new Set(symbols.filter((s) => s !== "$CASH"))].sort().slice(0, 40).join(",");
  const { data: prices } = useApi<Prices>(key ? `/api/prices?range=1y&symbols=${key}` : null);
  const { data: macro } = useMacro();
  const rf = (macro?.rates.tbill ?? 4) / 100;

  const rows = useMemo(() => households.map((h) => {
    const v = value(h, quotes);
    const plan = buildPlan(h, v), mc = simulate(plan, 2000);
    const checks = compliance(h, v);
    const a = prices ? analyze(v, prices, 252, rf) : null;
    const tlh = harvest(h, v);
    const items = attention(h, v, { checks, plan, harvestable: -sum(tlh.map((x) => x.gain)), harvestSaving: sum(tlh.map((x) => x.saving)) });
    return { h, v, mc, items, breaches: checks.filter((c) => c.status === "Breach").length, watch: checks.filter((c) => c.status === "Watch").length, stats: portfolioStats(v.policyWeights), oneYear: a?.port.total ?? null };
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
  const book = zeroWeights(), bookTarget = zeroWeights();
  rows.forEach((r) => CLASSES.forEach((c) => {
    book[c] += (r.v.policyWeights[c] * r.v.policy) / (totals.policy || 1);
    bookTarget[c] += ((r.h.ips.targets.find((t) => t.cls === c)?.target ?? 0) * r.v.policy) / (totals.policy || 1);
  }));
  const reading = macro?.available ? classify(macro.series, today()) : null;
  const s = macro?.series;

  const alerts = rows.flatMap((r) => [
    ...r.items.filter((i) => i.severity !== "low").map((i) => ({ icon: CircleAlert, tone: i.severity === "high" ? "neg" : "warn", text: i.title, who: r.h, href: `/households/${r.h.id}/${i.tab}` })),
    ...r.h.tasks.filter((t) => !t.done && daysUntil(t.due) <= 21 && daysUntil(t.due) >= 0).map((t) => ({ icon: ListTodo, tone: "info", text: `${t.title} · due ${date(t.due)}`, who: r.h, href: `/households/${r.h.id}/relationship` })),
    ...r.h.people.filter((p) => nextBirthday(p.dob) <= 30).map((p) => ({ icon: Cake, tone: "info", text: `${p.name}'s birthday in ${nextBirthday(p.dob)} days`, who: r.h, href: `/households/${r.h.id}/relationship` })),
    ...(r.h.nextMeeting && daysUntil(r.h.nextMeeting) <= 30 && daysUntil(r.h.nextMeeting) >= 0 ? [{ icon: CalendarDays, tone: "info", text: `Review meeting ${date(r.h.nextMeeting)}`, who: r.h, href: `/households/${r.h.id}/meeting` }] : []),
  ]).sort((x, y) => ["neg", "warn", "info"].indexOf(x.tone) - ["neg", "warn", "info"].indexOf(y.tone));

  const upcoming = rows.flatMap((r) => [
    ...(r.h.nextMeeting ? [{ date: r.h.nextMeeting, text: "Client review", who: r.h.name, href: `/households/${r.h.id}/meeting` }] : []),
    ...r.h.tasks.filter((t) => !t.done).map((t) => ({ date: t.due, text: t.title, who: r.h.name, href: `/households/${r.h.id}/relationship` })),
  ]).filter((u) => daysUntil(u.date) >= 0 && daysUntil(u.date) <= 30).sort((x, y) => (x.date < y.date ? -1 : 1));

  if (!households.length) return <><PageHeader eyebrow="Advisor dashboard" title="Welcome" sub="Start by adding your first client household." /><EmptyBook /></>;

  return (
    <>
      <PageHeader eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} title="Advisor dashboard"
        sub={`${households.length} client households. Positions are valued at live prices; plans rerun with every change.`} />

      <section className="panel">
        <div className="grid divide-border sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
          <div className="px-5 py-4"><div className="eyebrow">Household net worth</div><div className="num mt-1.5 text-[28px] leading-none font-semibold tracking-tight">{money(totals.netWorth)}</div><div className="mt-1.5 text-[12px] text-muted-foreground">{households.length} families, including real and private assets</div></div>
          <div className="px-5 py-4"><div className="eyebrow">Assets under advisement</div><div className="num mt-1.5 text-[20px] font-semibold">{money(totals.policy)}</div><div className={`num mt-1 text-[12px] ${tone(totals.day)}`}>{totals.day >= 0 ? "+" : ""}{money(totals.day)} today</div></div>
          <div className="px-5 py-4"><div className="eyebrow">Cash</div><div className="num mt-1.5 text-[20px] font-semibold">{money(totals.cash)}</div><div className="mt-1 text-[12px] text-muted-foreground">{pct(totals.cash / (totals.liquid || 1))} of liquid assets</div></div>
          <div className="px-5 py-4"><div className="eyebrow">Plan confidence</div><div className="num mt-1.5 text-[20px] font-semibold">{prob(weighted((r) => r.mc.success))}</div><div className="mt-1 text-[12px] text-muted-foreground">Asset-weighted across households</div></div>
        </div>
        <div className="border-t border-border px-5 py-2 text-[11.5px] text-muted-foreground">Prices {quotesAt ? `updated ${ago(quotesAt)}` : "loading"} · 2,000 simulations per household · economic data from FRED{macro?.series.DGS10?.latest ? ` through ${date(macro.series.DGS10.latest[0])}` : ""}</div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Households" sub="Portfolio figures cover accounts managed under each family's investment policy" pad={false}>
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead><tr><th>Household</th><th className="r">Net worth</th><th className="r">Invested</th><th className="r hidden 2xl:table-cell">Cash</th><th className="r">1-yr return</th><th className="r hidden 2xl:table-cell">Exp. volatility</th><th>Plan confidence</th><th>Policy</th><th className="hidden 2xl:table-cell">Next meeting</th></tr></thead>
              <tbody>
                {rows.map(({ h, v, mc, breaches, watch, stats, oneYear }) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap"><Link href={`/households/${h.id}`} className="font-medium hover:text-gold">{h.name}</Link><div className="text-[11.5px] text-muted-foreground">{h.tier} · {h.state}</div></td>
                    <td className="r">{money(v.netWorth)}</td>
                    <td className="r">{money(v.policy)}</td>
                    <td className="r hidden 2xl:table-cell">{money(v.cash)}</td>
                    <td className={`r ${tone(oneYear)}`}>{oneYear == null ? "…" : pct(oneYear, 1, true)}</td>
                    <td className="r hidden 2xl:table-cell">{pct(stats.vol)}</td>
                    <td><div className="flex items-center gap-2"><span className={`num w-12 text-right ${mc.success < 0.75 ? "text-neg" : mc.success < 0.9 ? "text-warn" : ""}`}>{prob(mc.success)}</span><div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${mc.success * 100}%`, background: mc.success < 0.75 ? "var(--neg)" : mc.success < 0.9 ? "var(--warn)" : "var(--pos)" }} /></div></div></td>
                    <td>{breaches ? <Pill kind="Breach">{breaches} breach{breaches > 1 ? "es" : ""}</Pill> : watch ? <Pill kind="Watch">{watch} to watch</Pill> : <Pill kind="Compliant">Compliant</Pill>}</td>
                    <td className="hidden whitespace-nowrap text-muted-foreground 2xl:table-cell">{h.nextMeeting ? date(h.nextMeeting) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-5 pt-3 pb-4">
            <div className="eyebrow mb-2">Next 30 days</div>
            <ul className="grid gap-x-8 gap-y-1.5 text-[12.5px] md:grid-cols-2">
              {upcoming.slice(0, 8).map((u, i) => (
                <li key={i} className="flex min-w-0 items-baseline gap-3">
                  <span className="num w-12 shrink-0 text-muted-foreground">{new Date(u.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <Link href={u.href} className="min-w-0 truncate hover:text-gold" title={`${u.text} · ${u.who}`}>{u.text} <span className="text-muted-foreground">· {u.who}</span></Link>
                </li>
              ))}
              {!upcoming.length && <li className="text-muted-foreground">Nothing scheduled.</li>}
            </ul>
          </div>
        </Panel>

        <Panel title="Needs attention" sub={`${alerts.length} items across the book, most urgent first`}>
          <ul className="space-y-1">
            {alerts.slice(0, 8).map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="flex gap-3 rounded-md px-2 py-2 hover:bg-raised">
                  <a.icon className={`mt-0.5 size-4 shrink-0 ${a.tone === "neg" ? "text-neg" : a.tone === "warn" ? "text-warn" : "text-c1"}`} />
                  <span className="min-w-0 text-[13px]"><span className="block truncate">{a.text}</span><span className="text-[11.5px] text-muted-foreground">{a.who.name}</span></span>
                </Link>
              </li>
            ))}
          </ul>
          {alerts.length > 8 && <Link href="/relationships" className="mt-2 block px-2 text-[12px] text-gold hover:underline">{alerts.length - 8} more across the book</Link>}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1.2fr)]">
        <Panel title="Book allocation" sub={`All policy portfolios · ${money(totals.policy)}`}>
          <div className="flex h-2.5 overflow-hidden rounded-sm" role="img" aria-label="Book allocation by asset class">
            {CLASSES.map((c) => <span key={c} style={{ width: `${book[c] * 100}%`, background: CLASS_COLOR[c] }} title={`${CLASS_LABEL[c]} ${pct(book[c], 1)}`} />)}
          </div>
          <table className="mt-3 w-full text-[12.5px]">
            <thead><tr className="text-[10.5px] tracking-wider text-muted-foreground uppercase"><th className="pb-1 text-left font-medium">Sleeve</th><th className="pb-1 text-right font-medium">Book</th><th className="pb-1 text-right font-medium">Avg target</th><th className="pb-1 text-right font-medium">Drift</th></tr></thead>
            <tbody>
              {CLASSES.map((c) => {
                const d = book[c] - bookTarget[c];
                return (
                  <tr key={c} className="border-t border-border/50">
                    <td className="py-1"><span className="flex items-center gap-2"><Dot color={CLASS_COLOR[c]} />{CLASS_LABEL[c]}</span></td>
                    <td className="num py-1 text-right">{pct(book[c], 1)}</td>
                    <td className="num py-1 text-right text-muted-foreground">{pct(bookTarget[c], 1)}</td>
                    <td className={`num py-1 text-right ${Math.abs(d) >= 0.03 ? "text-warn" : "text-muted-foreground"}`}>{pct(d, 1, true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] text-muted-foreground">Exp. return {pct(weighted((r) => r.stats.mean))} · volatility {pct(weighted((r) => r.stats.vol))}, asset-weighted</p>
        </Panel>

        <Panel title="Economic regime" sub="Rules-based, from FRED data" action={<Link href="/markets" className="text-[12px] text-gold hover:underline">Details</Link>}>
          {!macro ? <Loading label="Loading FRED data" /> : !reading ? <p className="text-[13px] text-muted-foreground">FRED data unavailable. Add FRED_API_KEY to enable.</p> : (
            <>
              <div className="flex items-center gap-3">
                <span className="rounded-md px-2.5 py-1 text-[15px] font-semibold text-background" style={{ background: REGIME_COLOR[reading.regime] }}>{reading.regime}</span>
                <span className="text-[12.5px] text-muted-foreground">{reading.reasons[0]}</span>
              </div>
              <table className="mt-3 w-full text-[12.5px]">
                <thead><tr className="text-[10.5px] tracking-wider text-muted-foreground uppercase"><th className="pb-1 text-left font-medium">Indicator</th><th className="pb-1 text-right font-medium">Latest</th><th className="pb-1 text-right font-medium">1-yr chg</th><th className="pb-1 text-right font-medium">As of</th></tr></thead>
                <tbody>
                  {([["CPI inflation (y/y)", s?.CPIAUCSL], ["Fed funds, effective", s?.DFF], ["10-yr Treasury", s?.DGS10], ["Unemployment", s?.UNRATE]] as const).map(([l, x]) => (
                    <tr key={l} className="border-t border-border/50">
                      <td className="py-1.5">{l}</td>
                      <td className="num py-1.5 text-right font-medium">{x?.latest ? `${x.latest[1].toFixed(2)}%` : "—"}</td>
                      <td className="num py-1.5 text-right text-muted-foreground">{x?.chg1y != null ? `${x.chg1y >= 0 ? "+" : ""}${x.chg1y.toFixed(2)}` : "—"}</td>
                      <td className="py-1.5 text-right text-[11.5px] text-muted-foreground">{x?.latest ? new Date(x.latest[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
