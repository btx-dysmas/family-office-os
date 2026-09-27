"use client";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Dot, Panel, Pill } from "@/components/kit";
import { Timeline } from "@/components/widgets";
import { analyze, type Prices } from "@/lib/analytics";
import { attention, type Severity } from "@/lib/attention";
import { CLASS_COLOR, CLASS_LABEL, CLASSES, INFLATION, portfolioStats, subclass } from "@/lib/cma";
import { useApi } from "@/lib/data";
import { ago, date, daysUntil, money, pct, prob, sum, tone } from "@/lib/format";
import { useHH } from "@/lib/household-context";
import { compliance, harvest } from "@/lib/ips";
import { estate } from "@/lib/planning";
import { COLLEGE_INFLATION } from "@/lib/reference";
import { heatMap } from "@/lib/risk";
import { timeline } from "@/lib/timeline";
import type { AssetClass, Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY = { 1: "Essential", 2: "Discretionary", 3: "Aspirational" } as const;
const SEV: Record<Severity, string> = { high: "bg-neg", medium: "bg-warn", low: "bg-c1" };

function Heading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border pb-2">
      <h2 className="font-serif text-[22px] tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Range band with the target tick and the current position marker. */
function RangeBar({ current, min, max, target }: { current: number; min: number; max: number; target: number }) {
  const scale = Math.max(0.6, max + 0.1, current + 0.05), x = (v: number) => `${(v / scale) * 100}%`;
  const off = current < min || current > max;
  return (
    <div className="relative h-4 w-full min-w-[120px]" title={`Range ${pct(min, 0)}–${pct(max, 0)}, target ${pct(target, 0)}, current ${pct(current, 1)}`}>
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-muted" />
      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded bg-gold/25" style={{ left: x(min), width: `calc(${x(max)} - ${x(min)})` }} />
      <div className="absolute top-0.5 h-3 w-px bg-gold" style={{ left: x(target) }} />
      <div className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", off ? "bg-neg" : "bg-foreground")} style={{ left: x(current) }} />
    </div>
  );
}

function assumptions(g: Goal, h: ReturnType<typeof useHH>["h"], plan: ReturnType<typeof useHH>["plan"]) {
  const flows = plan.flows.filter((f) => f.goal === g.id);
  const first = flows[0];
  if (g.type === "retirement") {
    return [
      ["Spending target", `${money(h.retirementSpending)} a year in today's dollars`],
      ["Other income", h.otherIncome ? `${money(h.otherIncome)} a year` : "None"],
      ["Withdrawals", "Net of Social Security, grossed up for federal income tax"],
      ["First year", `${g.year}${first ? `, withdrawal of ${money(-first.amount)}` : ""}`],
      ["Planning horizon", `To ${plan.start + plan.years}`],
    ];
  }
  if (g.type === "education")
    return [
      ["Cost", `${money(g.amount)} a year in today's dollars, ${g.years ?? 4} years`],
      ["Cost growth", `${pct(COLLEGE_INFLATION)} a year (${pct(COLLEGE_INFLATION - INFLATION)} above inflation)`],
      ["Funding", "529 balances first, then the family portfolio"],
      ["Total in today's dollars", money(-sum(flows.map((f) => f.amount)))],
    ];
  if (g.type === "legacy") return [["Target", `${money(g.amount)} to heirs at the end of the plan`], ["Counts", "Investable wealth plus property, private holdings and family trusts"], ["Excludes", "Foundation and donor-advised fund assets"]];
  return [["Amount", `${money(g.amount)}, withdrawn in ${g.year}`], ["Funding", "Family portfolio, after higher-priority goals that year"]];
}

export default function Overview() {
  const { h, v, plan, mc, macro, quotes, quotesAt } = useHH();
  const [open, setOpen] = useState<{ sleeve?: AssetClass; goal?: string; risk?: string }>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const symbols = [...new Set(v.positions.map((p) => p.symbol).filter((s) => s !== "$CASH"))].sort().join(",");
  const { data: prices } = useApi<Prices>(`/api/prices?range=1y&symbols=${symbols}`);
  const a = useMemo(() => (prices ? analyze(v, prices, 252, (macro?.rates.tbill ?? 4) / 100) : null), [prices, v, macro]);
  const stats = portfolioStats(v.policyWeights);
  const checks = compliance(h, v);
  const tlh = harvest(h, v);
  const est = useMemo(() => estate(h, v, plan), [h, v, plan]);
  const items = attention(h, v, { checks, plan, estateTax: est.baseline.tax, harvestable: -sum(tlh.map((x) => x.gain)), harvestSaving: sum(tlh.map((x) => x.saving)) });
  const heat = heatMap(h, v, { retirementProbability: mc.success, cpi: macro?.series.CPIAUCSL?.latest?.[1] }).sort((x, y) => y.score - x.score).slice(0, 5);
  const singles = v.positions.filter((p) => p.account.inPolicy && p.symbol !== "$CASH" && subclass(p.symbol) === "Single stocks").sort((x, y) => y.value - x.value);
  const base = `/households/${h.id}`;
  const priceDate = Object.values(quotes).find((q) => q?.date)?.date;
  const awaiting = (h.documents ?? []).filter((d) => d.status === "Awaiting signature");
  const ipsDue = daysUntil(`${Number(h.ips.lastReview.slice(0, 4)) + 1}${h.ips.lastReview.slice(4)}`);
  const lastChange = h.ips.changes?.[0];
  const categories: [string, number][] = [["Investment accounts", v.liquid], ...v.byKind];

  return (
    <div className="space-y-9">
      {/* Summary: one surface, figures separated by rules rather than boxes */}
      <section className="panel">
        <div className="grid divide-border sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)] lg:divide-x">
          <div className="px-5 py-4">
            <div className="eyebrow">Net worth</div>
            <div className="num mt-1.5 text-[30px] leading-none font-semibold tracking-tight">{money(v.netWorth)}</div>
            <div className="mt-1.5 text-[12px] text-muted-foreground">{money(v.assets)} assets · {money(v.debt)} liabilities</div>
          </div>
          <div className="px-5 py-4"><div className="eyebrow">Invested</div><div className="num mt-1.5 text-[19px] font-semibold">{money(v.policy)}</div><div className={cn("num mt-1 text-[12px]", tone(v.day))}>{v.day >= 0 ? "+" : ""}{money(v.day)} today</div></div>
          <div className="px-5 py-4"><div className="eyebrow">Cash</div><div className="num mt-1.5 text-[19px] font-semibold">{money(v.cash)}</div><div className={cn("mt-1 text-[12px]", v.ratios.liquidityMonths < h.ips.liquidityMonths ? "text-warn" : "text-muted-foreground")}>{v.ratios.liquidityMonths.toFixed(1)} months · policy {h.ips.liquidityMonths}</div></div>
          <div className="px-5 py-4"><div className="eyebrow">1-year return</div><div className={cn("num mt-1.5 text-[19px] font-semibold", a && tone(a.port.total))}>{a ? pct(a.port.total, 1, true) : "…"}</div><div className="mt-1 text-[12px] text-muted-foreground">{a ? `S&P 500 ${pct(a.bench.total, 1, true)}` : "Loading prices"}</div></div>
          <div className="px-5 py-4"><div className="eyebrow">Expected</div><div className="num mt-1.5 text-[19px] font-semibold">{pct(stats.mean - h.ips.advisoryFee)}</div><div className="mt-1 text-[12px] text-muted-foreground">{pct(stats.vol)} volatility, after fees</div></div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-5 py-2 text-[11.5px] text-muted-foreground">
          <span>Prices {quotesAt ? `updated ${ago(quotesAt, now)}` : "loading"}{priceDate ? ` · last close ${date(priceDate)}` : ""}</span>
          <span>{h.accounts.length} accounts at {new Set(h.accounts.map((x) => x.custodian)).size} custodians, entered manually</span>
          <span>Private assets at last appraisal</span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section>
          <Heading action={<span className="text-[12px] text-muted-foreground">{items.length} open</span>}>Attention required</Heading>
          {items.length ? (
            <ul className="divide-y divide-border/70">
              {items.slice(0, 8).map((it, i) => (
                <li key={i}>
                  <Link href={`${base}/${it.tab}`} className="group flex items-start gap-3 py-2.5">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", SEV[it.severity])} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] group-hover:text-gold" title={it.title}>{it.title}</span><span className="block truncate text-[12px] text-muted-foreground" title={it.detail}>{it.detail}</span></span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50 group-hover:text-gold" />
                  </Link>
                </li>
              ))}
              {items.length > 8 && <li className="py-2 text-[12px] text-muted-foreground">and {items.length - 8} more</li>}
            </ul>
          ) : <p className="py-6 text-[13px] text-muted-foreground">Nothing needs attention. The portfolio is within policy and no documents are outstanding.</p>}
        </section>

        <section>
          <Heading>Service</Heading>
          <dl className="divide-y divide-border/70 text-[13px]">
            {([
              ["Last portfolio review", h.lastReview ? date(h.lastReview.date) : "Not recorded"],
              ["IPS", ipsDue < 0 ? <span key="i" className="text-neg">Review overdue</span> : `Reviewed ${date(h.ips.lastReview)}, next due in ${ipsDue} days`],
              ["Next client meeting", h.nextMeeting ? <Link key="m" href={`${base}/meeting`} className="hover:text-gold">{date(h.nextMeeting)} · prepare brief</Link> : "Not scheduled"],
              ["Open tasks", `${h.tasks.filter((t) => !t.done).length}`],
              ["Documents", awaiting.length ? <span key="d" className="text-warn">{awaiting.length} awaiting signature</span> : "Nothing outstanding"],
              ["Beneficiary designations", h.beneficiaryReview ? <span key="b" className={-daysUntil(h.beneficiaryReview) > 1095 ? "text-warn" : ""}>Confirmed {date(h.beneficiaryReview)}</span> : "Not on file"],
              ["Latest IPS change", lastChange ? <span key="c" title={lastChange.summary}>{date(lastChange.date)}</span> : "None recorded"],
            ] as const).map(([k, val]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{val}</dd></div>
            ))}
          </dl>
          {lastChange && <p className="mt-2 text-[12px] text-muted-foreground">{lastChange.summary}.</p>}
        </section>
      </div>

      <section className="space-y-4">
        <Heading action={<Link href={`${base}/portfolio`} className="flex items-center gap-1 text-[12px] text-gold hover:underline">Holdings and performance <ArrowUpRight className="size-3" /></Link>}>Portfolio</Heading>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div>
            <table className="grid-table">
              <thead><tr><th>Sleeve</th><th className="r">Current</th><th className="r">Target</th><th className="r">Range</th><th className="w-[36%]"><span className="sr-only">Position in range</span></th></tr></thead>
              <tbody>
                {CLASSES.filter((c) => v.policyWeights[c] > 0 || (h.ips.targets.find((t) => t.cls === c)?.target ?? 0) > 0).map((c) => {
                  const t = h.ips.targets.find((x) => x.cls === c) ?? { cls: c, target: 0, min: 0, max: 0 };
                  const cur = v.policyWeights[c], off = cur < t.min - 1e-9 || cur > t.max + 1e-9, expanded = open.sleeve === c;
                  const subs = new Map<string, number>();
                  v.positions.filter((p) => p.account.inPolicy && p.cls === c).forEach((p) => subs.set(subclass(p.symbol), (subs.get(subclass(p.symbol)) ?? 0) + p.value));
                  return [
                    <tr key={c} className="cursor-pointer" onClick={() => setOpen({ ...open, sleeve: expanded ? undefined : c })}>
                      <td><span className="flex items-center gap-2"><ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")} /><Dot color={CLASS_COLOR[c]} />{CLASS_LABEL[c]}</span></td>
                      <td className={cn("r", off && "text-neg")}>{pct(cur, 1)}</td>
                      <td className="r text-muted-foreground">{pct(t.target, 0)}</td>
                      <td className="r text-muted-foreground">{pct(t.min, 0)}–{pct(t.max, 0)}</td>
                      <td><RangeBar current={cur} min={t.min} max={t.max} target={t.target} /></td>
                    </tr>,
                    ...(expanded ? [...subs.entries()].sort((x, y) => y[1] - x[1]).map(([s, val]) => (
                      <tr key={c + s} className="text-[12.5px] text-muted-foreground">
                        <td className="pl-12">{s}</td><td className="r">{pct(val / v.policy, 1)}</td><td className="r" colSpan={2}>{money(val)}</td><td />
                      </tr>
                    )) : []),
                  ];
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-muted-foreground">Select a sleeve to see what it holds. The shaded band is the IPS range; the tick is the target. <Link href={`${base}/policy`} className="text-gold hover:underline">Investment policy</Link></p>
          </div>

          <div className="space-y-5">
            <div>
              <div className="eyebrow mb-1">Largest risks</div>
              <ul className="divide-y divide-border/70">
                {heat.map((c) => (
                  <li key={c.name}>
                    <button className="flex w-full items-center justify-between gap-3 py-2 text-left" onClick={() => setOpen({ ...open, risk: open.risk === c.name ? undefined : c.name })}>
                      <span className="text-[13px]">{c.name}</span><Pill kind={c.level}>{c.level}</Pill>
                    </button>
                    {open.risk === c.name && (
                      <div className="pb-3 text-[12.5px]">
                        <p className="text-muted-foreground">{c.driver}.</p>
                        <p className="mt-1">{c.action} <Link href={`${base}/risk`} className="text-gold hover:underline">Details</Link></p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {singles.length > 0 && (
              <div>
                <div className="eyebrow mb-1">Single-stock positions</div>
                <ul className="text-[13px]">
                  {singles.slice(0, 4).map((p, i) => (
                    <li key={i} className="flex justify-between gap-3 py-1">
                      <span><b className="font-medium">{p.symbol}</b> <span className="text-muted-foreground">{p.account.name}</span></span>
                      <span className={cn("num", p.value / v.policy > h.ips.limits.maxPosition && "text-neg")}>{pct(p.value / v.policy, 1)} · {money(p.gain)} gain</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <Heading action={<Link href={`${base}/planning`} className="flex items-center gap-1 text-[12px] text-gold hover:underline">Plan and scenarios <ArrowUpRight className="size-3" /></Link>}>Family planning</Heading>
        <div>
          <div className="mb-1 flex items-baseline justify-between text-[12px] text-muted-foreground">
            <span>Monte Carlo confidence · {mc.runs.toLocaleString("en-US")} simulations · {prob(mc.success)} probability the plan lasts</span>
            <span>Select a goal for its assumptions</span>
          </div>
          <table className="grid-table">
            <thead><tr><th>Goal</th><th>Priority</th><th className="r">Timing</th><th className="r">Amount</th><th className="r">Confidence</th><th className="w-[22%]"><span className="sr-only">Confidence bar</span></th></tr></thead>
            <tbody>
              {h.goals.map((g) => {
                const p = g.type === "retirement" ? mc.success : mc.probability[g.id] ?? 1, expanded = open.goal === g.id;
                return [
                  <tr key={g.id} className="cursor-pointer" onClick={() => setOpen({ ...open, goal: expanded ? undefined : g.id })}>
                    <td><span className="flex items-center gap-2"><ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")} /><span className="max-w-[260px] truncate" title={g.name}>{g.name}</span></span></td>
                    <td className="text-muted-foreground">{PRIORITY[g.priority]}</td>
                    <td className="r">{g.type === "education" ? `${g.year}–${String(g.year + (g.years ?? 4) - 1).slice(2)}` : g.type === "legacy" ? "End of plan" : g.type === "retirement" ? `From ${g.year}` : g.year}</td>
                    <td className="r">{money(g.amount)}{g.type === "education" || g.type === "retirement" ? "/yr" : ""}</td>
                    <td className={cn("r font-medium", p < 0.75 ? "text-neg" : p < 0.9 ? "text-warn" : "")}>{prob(p)}</td>
                    <td><div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: p < 0.75 ? "var(--neg)" : p < 0.9 ? "var(--warn)" : "var(--pos)" }} /></div></td>
                  </tr>,
                  ...(expanded ? [
                    <tr key={g.id + "x"}><td colSpan={6} className="!bg-subtle">
                      <dl className="grid gap-x-8 gap-y-1 py-1 text-[12.5px] sm:grid-cols-2">
                        {assumptions(g, h, plan).map(([k, val]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{val}</dd></div>)}
                      </dl>
                    </td></tr>,
                  ] : []),
                ];
              })}
            </tbody>
          </table>
        </div>
        <div>
          <div className="eyebrow mb-2">Timeline</div>
          <Timeline items={timeline(h)} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Balance sheet" action={<Link href={`${base}/balance-sheet`} className="text-[12px] text-gold hover:underline">Details</Link>}>
          <table className="w-full text-[13px]">
            <tbody>
              {categories.map(([k, val]) => (
                <tr key={k}>
                  <td className="py-1.5">{k}</td>
                  <td className="w-[40%] py-1.5 pr-3"><div className="h-1.5 rounded-full bg-c1/70" style={{ width: `${(val / v.assets) * 100}%` }} /></td>
                  <td className="num py-1.5 text-right">{money(val)}</td>
                </tr>
              ))}
              <tr className="border-t border-border"><td className="pt-2 text-muted-foreground">Liabilities</td><td /><td className="num pt-2 text-right text-neg">−{money(v.debt)}</td></tr>
            </tbody>
          </table>
        </Panel>
        <Panel title="Wealth transfer" action={<Link href={`${base}/estate`} className="text-[12px] text-gold hover:underline">Strategies</Link>}>
          <dl className="divide-y divide-border/70 text-[13px]">
            {([
              ["Inside the taxable estate", money(v.estate)],
              ["Already outside the estate", money(est.excluded)],
              [`Projected estate at ${est.deathYear}`, money(est.baseline.gross)],
              ["Federal estate tax, no planning", est.baseline.tax ? <span key="t" className="text-neg">{money(est.baseline.tax)}</span> : "None"],
              ["Heirs named", String(h.people.filter((p) => ["child", "grandchild", "other"].includes(p.relationship)).length)],
            ] as const).map(([k, val]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="num">{val}</dd></div>)}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
