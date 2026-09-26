"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Dot, Panel, Stat } from "@/components/kit";
import Plot from "@/components/Plot";
import { GoalCard, HeatGrid, Timeline } from "@/components/widgets";
import { analyze, type Prices } from "@/lib/analytics";
import { donut, hbars } from "@/lib/charts";
import { CLASS_COLOR, CLASS_LABEL, CLASSES, portfolioStats } from "@/lib/cma";
import { useApi } from "@/lib/data";
import { date, money, pct, tone } from "@/lib/format";
import { useHH } from "@/lib/household-context";
import { compliance } from "@/lib/ips";
import { heatMap } from "@/lib/risk";
import { timeline } from "@/lib/timeline";

export default function Overview() {
  const { h, v, mc, macro } = useHH();
  const symbols = [...new Set(v.positions.map((p) => p.symbol).filter((s) => s !== "$CASH"))].sort().join(",");
  const { data: prices } = useApi<Prices>(`/api/prices?range=1y&symbols=${symbols}`);
  const a = useMemo(() => (prices ? analyze(v, prices, 252, (macro?.rates.tbill ?? 4) / 100) : null), [prices, v, macro]);
  const stats = portfolioStats(v.policyWeights);
  const checks = compliance(h, v);
  const breaches = checks.filter((c) => c.status === "Breach");
  const heat = heatMap(h, v, { retirementProbability: mc.success, cpi: macro?.series.CPIAUCSL?.latest?.[1] });
  const assetRows: [string, number][] = [["Investment accounts", v.liquid], ...v.byKind];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Net worth" value={money(v.netWorth)} sub={`${money(v.assets)} assets, ${money(v.debt)} liabilities`} />
        <Stat label="Invested assets" value={money(v.policy)} sub={<span className={tone(v.day)}>{v.day >= 0 ? "+" : ""}{money(v.day)} today</span>} />
        <Stat label="Cash" value={money(v.cash)} sub={`${v.ratios.liquidityMonths.toFixed(1)} months of spending`} tone={v.ratios.liquidityMonths < h.ips.liquidityMonths ? "warn" : undefined} />
        <Stat label="1-year return" value={a ? pct(a.port.total, 1, true) : "…"} tone={a ? (a.port.total >= 0 ? "pos" : "neg") : undefined} sub={a ? `S&P 500 ${pct(a.bench.total, 1, true)}` : "Loading prices"} />
        <Stat label="Expected return / risk" value={`${pct(stats.mean - h.ips.advisoryFee)} / ${pct(stats.vol)}`} sub="After fees, from capital market assumptions" />
      </div>

      <Panel title="Goals" sub={`Probability each goal is fully funded, from ${mc.runs.toLocaleString("en-US")} simulations`} action={<Link href={`/households/${h.id}/planning`} className="text-[12px] text-gold hover:underline">Plan details</Link>}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {h.goals.map((g) => <GoalCard key={g.id} goal={g} probability={g.type === "retirement" ? mc.success : mc.probability[g.id]} />)}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Allocation" sub="Policy portfolio against IPS targets">
          <div className="grid grid-cols-[150px_1fr] items-center gap-4">
            <Plot fig={donut(CLASSES.map((c) => CLASS_LABEL[c]), CLASSES.map((c) => v.policyWeights[c]), CLASSES.map((c) => CLASS_COLOR[c]))} height={150} />
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-[10.5px] tracking-wider text-muted-foreground uppercase"><th className="pb-1 text-left font-medium">Sleeve</th><th className="pb-1 pl-3 text-right font-medium">Now</th><th className="pb-1 pl-3 text-right font-medium">Target</th></tr></thead>
              <tbody>
                {CLASSES.map((c) => {
                  const t = h.ips.targets.find((x) => x.cls === c);
                  const off = t && (v.policyWeights[c] < t.min || v.policyWeights[c] > t.max);
                  return (
                    <tr key={c}>
                      <td className="py-0.5"><span className="flex items-center gap-2"><Dot color={CLASS_COLOR[c]} />{CLASS_LABEL[c]}</span></td>
                      <td className={`num py-0.5 text-right ${off ? "text-neg" : ""}`}>{pct(v.policyWeights[c], 0)}</td>
                      <td className="num py-0.5 text-right text-muted-foreground">{pct(t?.target ?? 0, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">{breaches.length ? `${breaches.length} policy ${breaches.length === 1 ? "breach" : "breaches"}: ${breaches.map((b) => b.rule.split(" (")[0]).join("; ")}.` : "All policy limits are met."} <Link href={`/households/${h.id}/policy`} className="text-gold hover:underline">View IPS</Link></p>
        </Panel>

        <Panel title="Family balance sheet" sub={`Debt ${pct(v.ratios.debtToAssets, 0)} of assets`}>
          <Plot fig={hbars(assetRows.map((r) => r[0]), assetRows.map((r) => r[1]), "#6f9cf6", "$~s")} height={Math.max(150, assetRows.length * 30 + 40)} />
          <div className="mt-2 flex justify-between border-t border-border pt-3 text-[13px]"><span className="text-muted-foreground">Liabilities</span><span className="num text-neg">−{money(v.debt)}</span></div>
        </Panel>

        <Panel title="Risk heat map" sub="Highest-scoring dimensions" action={<Link href={`/households/${h.id}/risk`} className="text-[12px] text-gold hover:underline">All risks</Link>}>
          <HeatGrid cells={[...heat].sort((a, b) => b.score - a.score).slice(0, 6)} compact />
        </Panel>
      </div>

      <Panel title="Household timeline" sub="Milestones derived from ages, goals, loans and the plan">
        <Timeline items={timeline(h)} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent activity" action={<Link href={`/households/${h.id}/relationship`} className="text-[12px] text-gold hover:underline">Relationship</Link>}>
          <ul className="space-y-3">
            {[...h.notes].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3).map((n) => (
              <li key={n.id} className="text-[13px]"><div className="text-[11.5px] text-muted-foreground">{date(n.date)} · {n.category}</div>{n.summary}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Next review" sub={h.nextMeeting ? date(h.nextMeeting) : "Not scheduled"} action={<Link href={`/households/${h.id}/meeting`} className="text-[12px] text-gold hover:underline">Prepare</Link>}>
          <ul className="space-y-2 text-[13px]">
            {h.tasks.filter((t) => !t.done).map((t) => <li key={t.id} className="flex justify-between gap-4"><span>{t.title}</span><span className="shrink-0 text-muted-foreground">{date(t.due)}</span></li>)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
