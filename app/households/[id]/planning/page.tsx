"use client";
import { useMemo, useState } from "react";
import { KV, Note, Panel, Pill, Segmented } from "@/components/kit";
import Plot from "@/components/Plot";
import { Button } from "@/components/ui/button";
import { GoalCard } from "@/components/widgets";
import { fan, histogram } from "@/lib/charts";
import { money, pct, prob, thisYear, uid, usd } from "@/lib/format";
import { clients, primary } from "@/lib/household";
import { useHH } from "@/lib/household-context";
import { buildPlan, simulate, withdrawalSuccess } from "@/lib/montecarlo";
import { affordability, education, retirementGap } from "@/lib/planning";
import { TUITION } from "@/lib/reference";
import { socialSecurity } from "@/lib/tax";
import type { LifeEvent, LifeEventType } from "@/lib/types";
import { cn } from "@/lib/utils";

const EVENTS: { type: LifeEventType; label: string; field?: string; amount?: number; duration?: number; hint: string }[] = [
  { type: "market-crash", label: "Market crash", field: "Portfolio return that year (%)", amount: -35, hint: "A 2008-style year replaces the random draw." },
  { type: "job-loss", label: "Job loss", field: "Years without income", duration: 1, hint: "The primary earner's after-tax pay stops; savings fund the gap." },
  { type: "inflation-spike", label: "Inflation spike", field: "Extra inflation (pts)", amount: 4, duration: 3, hint: "Nominal assets lose real value for three years." },
  { type: "home-purchase", label: "Home purchase", field: "Down payment and costs ($)", amount: 150_000, hint: "A one-time withdrawal." },
  { type: "new-child", label: "New child", field: "Annual cost ($)", amount: 18_000, duration: 18, hint: "Added spending for 18 years." },
  { type: "divorce", label: "Divorce", field: "Share of assets transferred (%)", amount: 50, hint: "Assets split; savings halve and spending falls to 65%." },
  { type: "inheritance", label: "Inheritance", field: "Amount received ($)", amount: 500_000, hint: "A one-time addition to the portfolio." },
];
const PCT_FIELDS: LifeEventType[] = ["market-crash", "inflation-spike", "divorce"];

function LifeEvents({ onChange, events }: { events: LifeEvent[]; onChange: (e: LifeEvent[]) => void }) {
  const year = thisYear() + 1;
  return (
    <div className="space-y-2">
      {EVENTS.map((def) => {
        const on = events.find((e) => e.type === def.type);
        const set = (patch: Partial<LifeEvent>) => onChange(events.map((e) => (e.type === def.type ? { ...e, ...patch } : e)));
        const isPct = PCT_FIELDS.includes(def.type);
        return (
          <div key={def.type} className={cn("rounded-lg border px-3 py-2.5 transition-colors", on ? "border-gold/40 bg-gold/5" : "border-border bg-subtle")}>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-[13px] font-medium">{def.label}</span>
              <input type="checkbox" checked={!!on} className="size-4 accent-[var(--gold)]"
                onChange={(e) => onChange(e.target.checked
                  ? [...events, { id: uid(), type: def.type, year, amount: def.amount == null ? undefined : isPct ? def.amount / 100 : def.amount, duration: def.duration }]
                  : events.filter((x) => x.type !== def.type))} />
            </label>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{def.hint}</p>
            {on && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-muted-foreground">Year<input type="number" className="field-num mt-0.5" value={on.year} onChange={(e) => set({ year: +e.target.value })} /></label>
                {def.field && (
                  <label className="text-[11px] text-muted-foreground">{def.field}
                    <input type="number" className="field-num mt-0.5"
                      value={def.type === "job-loss" ? on.duration ?? 1 : isPct ? +((on.amount ?? 0) * 100).toFixed(1) : on.amount ?? 0}
                      onChange={(e) => set(def.type === "job-loss" ? { duration: +e.target.value } : { amount: isPct ? +e.target.value / 100 : +e.target.value })} />
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Planning() {
  const { h, v, plan, mc, macro, update } = useHH();
  const [runs, setRuns] = useState(5000);
  const [scenario, setScenario] = useState<LifeEvent[]>(h.events);
  const changed = JSON.stringify(scenario) !== JSON.stringify(h.events);
  const base = useMemo(() => (runs === mc.runs ? mc : simulate(plan, runs)), [runs, mc, plan]);
  const scen = useMemo(() => (changed ? simulate(buildPlan(h, v, scenario), runs) : base), [changed, h, v, scenario, runs, base]);
  const gap = retirementGap(h, plan);
  const me = primary(h);
  const ss = clients(h).map((p) => ({ p, ...socialSecurity(p, clients(h).find((x) => x.id !== p.id)) }));
  const edu = education(h, v);
  const wr = useMemo(() => {
    const rates = [0.03, 0.035, 0.04, 0.045, 0.05, 0.06], horizons = [20, 25, 30, 35, 40];
    return { rates, horizons, grid: rates.map((r) => horizons.map((n) => withdrawalSuccess(plan.weights, h.ips.advisoryFee, r, n))) };
  }, [plan.weights, h.ips.advisoryFee]);
  const mortgageRate = (macro?.series.MORTGAGE30US?.latest?.[1] ?? 6.5) / 100;
  const [home, setHome] = useState({ income: clients(h).reduce((s, p) => s + (p.income ?? 0), 0), down: h.goals.find((g) => g.type === "home")?.amount ?? 100_000 });
  const aff = affordability({ income: home.income, monthlyDebts: h.liabilities.filter((l) => l.kind !== "mortgage").reduce((s, l) => s + l.payment, 0), rate: mortgageRate, downPayment: home.down });
  const planYears = gap.yearsToRetire;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Goal-based plan" sub={changed ? "Life-event scenario; changes are against the base plan" : `Monte Carlo confidence · ${runs.toLocaleString("en-US")} simulations`}
          action={<Segmented value={runs} options={[[1000, "1,000"], [5000, "5,000"], [10000, "10,000"]]} onChange={setRuns} />}>
          <div className="grid gap-3 md:grid-cols-2">
            {h.goals.map((g) => <GoalCard key={g.id} goal={g} probability={g.type === "retirement" ? scen.success : scen.probability[g.id]} compare={changed ? (g.type === "retirement" ? base.success : base.probability[g.id]) : undefined} />)}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {([
              ["Probability of success", prob(scen.success), scen.success >= 0.8 ? "pos" : scen.success >= 0.6 ? "warn" : "neg"],
              ["Probability of depletion", prob(scen.depletion), scen.depletion > 0.2 ? "neg" : undefined],
              ["Median ending wealth", money(scen.ending.median)],
              ["Worst case", money(scen.ending.worst)],
              ["5th percentile", money(scen.ending.p5)],
              ["Best case", money(scen.ending.best)],
            ] as const).map(([k, val, t]) => (
              <div key={k} className="rounded-md border border-border bg-subtle px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground">{k}</div>
                <div className={cn("num mt-1 text-[17px] font-semibold", t === "pos" && "text-pos", t === "neg" && "text-neg", t === "warn" && "text-warn")}>{val}</div>
              </div>
            ))}
          </div>
          {scen.medianDepletionYear && <Note>In the paths that run short, money typically runs out around {scen.medianDepletionYear} (age {scen.medianDepletionYear - Number(me.dob.slice(0, 4))}).</Note>}
        </Panel>
        <Panel title="Life events" sub="Toggle events to stress the plan; every goal recalculates"
          action={changed && <Button size="xs" onClick={() => update((x) => ({ ...x, events: scenario }))}>Save to plan</Button>}>
          <LifeEvents events={scenario} onChange={setScenario} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Projected investable wealth" sub="Today's dollars. Bands hold the middle 50% and 90% of simulated paths.">
          <Plot fig={fan(scen.years, scen.bands, { x: plan.retireYear, label: "Retirement" })} height={330} />
        </Panel>
        <Panel title="Distribution of outcomes" sub="Investable wealth at the end of the plan">
          <Plot fig={histogram(scen.endingSample)} height={330} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Retirement engine" sub="Deterministic check at the median return">
          <div className={cn("mb-4 rounded-lg px-4 py-3", gap.gap >= 0 ? "bg-pos/10 ring-1 ring-pos/25" : "bg-neg/10 ring-1 ring-neg/25")}>
            <div className="eyebrow">{gap.gap >= 0 ? "Retirement surplus" : "Retirement shortfall"}</div>
            <div className={cn("num mt-1 text-[26px] font-semibold", gap.gap >= 0 ? "text-pos" : "text-neg")}>{money(Math.abs(gap.gap))}</div>
          </div>
          <KV rows={[
            ["Years until retirement", String(planYears)],
            ["Projected assets at retirement", money(gap.projected)],
            ["Needed at retirement", money(gap.required)],
            ["First-year withdrawal rate", gap.withdrawalRate != null ? pct(gap.withdrawalRate) : "—"],
            ["Extra savings to close the gap", gap.extraSavings ? `${usd(gap.extraSavings)}/yr` : "None needed"],
            ["Median real return assumed", pct(gap.rate, 2)],
          ]} />
          <Note>&quot;Needed&quot; is the present value, at retirement, of every later withdrawal: the withdrawal that leaves planned spending after federal tax, plus goals after retirement. Withdrawals come pro rata from the accounts: tax-deferred money is ordinary income, taxable accounts owe tax only on their gains and Roth money is tax-free. The tax also counts required minimum distributions, the extra deductions for anyone 65 or older and the taxable part of Social Security (up to 85%).</Note>
        </Panel>

        <Panel title="Withdrawal rate analysis" sub="Chance a fixed real withdrawal lasts, at the policy mix">
          <table className="grid-table">
            <thead><tr><th>Rate</th>{wr.horizons.map((n) => <th key={n} className="r">{n} yrs</th>)}</tr></thead>
            <tbody>
              {wr.rates.map((r, i) => (
                <tr key={r} className={gap.withdrawalRate != null && Math.abs(gap.withdrawalRate - r) < 0.0026 ? "ring-1 ring-gold/50" : ""}>
                  <td className="font-medium">{pct(r, 1)}</td>
                  {wr.grid[i].map((p, j) => <td key={j} className="r" style={{ background: p >= 0.9 ? "rgba(76,195,138,.14)" : p >= 0.75 ? "rgba(227,169,72,.14)" : "rgba(239,107,107,.14)" }}>{pct(p, 0)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <Note>Green is 90% or better. The household&apos;s planned first-year rate is {gap.withdrawalRate != null ? pct(gap.withdrawalRate) : "not yet known"}; sustainable spending is the highest rate that stays green for the retirement length ({plan.years - planYears} years).</Note>
        </Panel>

        <Panel title="Social Security" sub="2026 benefit formula, estimated from current earnings">
          <table className="grid-table">
            <thead><tr><th>Person</th><th className="r">PIA / mo</th><th className="r">Claim age</th><th className="r">Annual benefit</th></tr></thead>
            <tbody>
              {ss.map(({ p, pia, annual, claimAge, factor }) => (
                <tr key={p.id}><td>{p.name.split(" ")[0]}</td><td className="r">{usd(pia)}</td><td className="r">{claimAge} ({pct(factor, 0)})</td><td className="r font-semibold">{usd(annual)}</td></tr>
              ))}
            </tbody>
          </table>
          <Note>PIA = 90% of AIME up to $1,286, 32% up to $7,749 and 15% above (2026 bend points), with AIME approximated from current pay capped at the $184,500 wage base. With a full retirement age of 67, claiming at 62 cuts the benefit to 70% of PIA and waiting to 70 raises it to 124%; full retirement age is earlier for anyone born before 1960. A lower-earning spouse also receives the amount by which half the worker&apos;s PIA exceeds their own, reduced if claimed early and never increased by waiting. Figures are in today&apos;s dollars; use SSA statements for exact amounts.</Note>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Education funding" sub="College Board 2025–26 published prices plus a living-cost assumption, inflating 3.5% a year" pad={false}>
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead><tr><th>Goal</th><th className="r">Starts</th><th className="r">Cost today / yr</th><th className="r">Total, future $</th><th className="r">Saved (529)</th><th>Funded</th><th className="r">Monthly to close</th></tr></thead>
              <tbody>
                {edu.map((e) => (
                  <tr key={e.goal.id}>
                    <td className="font-medium">{e.goal.name}</td><td className="r">{e.goal.year}</td><td className="r">{usd(e.goal.amount)}</td><td className="r">{money(e.nominal)}</td>
                    <td className="r">{money(e.saved)}</td>
                    <td><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-c2" style={{ width: `${e.funded * 100}%` }} /></div><span className="num text-[12px]">{pct(e.funded, 0)}</span></div></td>
                    <td className="r">{e.monthly ? usd(e.monthly) : "Funded"}</td>
                  </tr>
                ))}
                {!edu.length && <tr><td colSpan={7} className="text-muted-foreground">No education goals.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <div className="mt-2 flex flex-wrap gap-2">{Object.entries(TUITION).map(([k, val]) => <Pill key={k}>{k}: {usd(val)} tuition</Pill>)}</div>
            <Note>529 balances are split evenly across education goals and grow at a 60/20/20 stock and bond mix. &quot;Monthly to close&quot; is the level contribution that fully funds the first tuition year onward.</Note>
          </div>
        </Panel>

        <Panel title="Home purchase affordability" sub={`28/36 rule at today's ${pct(mortgageRate, 2)} 30-year rate (FRED)`}>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11.5px] text-muted-foreground">Gross household income<input type="number" className="field-num mt-1" value={home.income} onChange={(e) => setHome({ ...home, income: +e.target.value })} /></label>
            <label className="text-[11.5px] text-muted-foreground">Down payment<input type="number" className="field-num mt-1" value={home.down} onChange={(e) => setHome({ ...home, down: +e.target.value })} /></label>
          </div>
          <div className="mt-4 rounded-lg bg-raised px-4 py-3"><div className="eyebrow">Maximum home price</div><div className="num mt-1 text-[26px] font-semibold text-gold">{money(aff.price)}</div></div>
          <KV className="mt-3" rows={[
            ["Loan amount", usd(aff.loan)],
            ["Principal and interest", `${usd(aff.payment)}/mo`],
            ["Taxes and insurance (1.5%/yr)", `${usd(aff.taxesInsurance)}/mo`],
            ["Housing cost / gross income", pct(aff.frontEnd)],
          ]} />
          <Note>Housing costs are capped at 28% of gross monthly income and all debt payments at 36%. Other monthly debts: {usd(h.liabilities.filter((l) => l.kind !== "mortgage").reduce((s, l) => s + l.payment, 0))}.</Note>
        </Panel>
      </div>
    </div>
  );
}
