"use client";
import { CheckCircle2, CircleAlert, Eye, Pencil, Printer } from "lucide-react";
import { useState } from "react";
import { Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { CLASS_LABEL, CLASSES, portfolioStats } from "@/lib/cma";
import { date, money, pct, sum, thisYear, today } from "@/lib/format";
import { targetWeights } from "@/lib/household";
import { useHH } from "@/lib/household-context";
import { compliance, type Status } from "@/lib/ips";
import { useStress } from "@/lib/use-stress";
import type { AssetClass, IPS } from "@/lib/types";

const BENCH: Record<AssetClass, string> = {
  us: "MSCI USA IMI", intl: "MSCI ACWI ex-USA IMI", bonds: "Bloomberg U.S. Aggregate", realestate: "FTSE Nareit All Equity REITs", alts: "Bloomberg Commodity / gold", cash: "ICE BofA 3-Month T-Bill",
};
const ICON: Record<Status, typeof CheckCircle2> = { Compliant: CheckCircle2, Watch: Eye, Breach: CircleAlert };
const COLOR: Record<Status, string> = { Compliant: "text-pos", Watch: "text-warn", Breach: "text-neg" };

function Article({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-5 [&:nth-child(2)]:border-t-0 [&:nth-child(2)]:pt-0">
      <h3 className="mb-2 flex items-baseline gap-3 text-[11px] font-semibold tracking-[0.14em] text-gold uppercase"><span className="num text-muted-foreground">{n}</span>{title}</h3>
      <div className="prose-doc">{children}</div>
    </section>
  );
}

export default function Policy() {
  const { h, v, plan, update } = useHH();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<IPS>(h.ips);
  const ips = edit ? draft : h.ips;
  const stress = useStress(v.policyWeights);
  const checks = compliance(h, v, stress.worst);
  const counts = { Compliant: 0, Watch: 0, Breach: 0 };
  checks.forEach((c) => counts[c.status]++);
  const policyStats = portfolioStats(targetWeights({ ...h, ips }));
  const policyAccounts = h.accounts.filter((a) => a.inPolicy), excluded = h.accounts.filter((a) => !a.inPolicy);
  const next5 = plan.flows.filter((f) => f.amount < 0 && f.year < thisYear() + 5);
  const totalTarget = sum(ips.targets.map((t) => t.target));

  const setTarget = (cls: AssetClass, key: "target" | "min" | "max", val: number) =>
    setDraft((d) => ({ ...d, targets: d.targets.map((t) => (t.cls === cls ? { ...t, [key]: val / 100 } : t)) }));
  const setLimit = (key: keyof IPS["limits"], val: number) => setDraft((d) => ({ ...d, limits: { ...d.limits, [key]: val / 100 } }));
  const num = (value: number, on: (x: number) => void, step = 1) => <input type="number" step={step} value={+(value * 100).toFixed(2)} onChange={(e) => on(+e.target.value)} className="field-num h-7 w-20" />;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Panel title="Investment Policy Statement" sub={`${h.name} · Effective ${date(ips.effective)} · Last reviewed ${date(ips.lastReview)}`}
        action={edit ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setEdit(false); setDraft(h.ips); }}>Cancel</Button>
            <Button size="sm" disabled={Math.abs(totalTarget - 1) > 0.001} onClick={() => { update((x) => ({ ...x, ips: { ...draft, lastReview: today() } })); setEdit(false); }}>Save and mark reviewed</Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Print</Button>
            <Button variant="outline" size="sm" onClick={() => { setDraft(h.ips); setEdit(true); }}><Pencil /> Edit policy</Button>
          </>
        )}>
        <div className="mx-auto max-w-[860px] rounded-lg border border-border bg-subtle px-8 py-7">
          <div className="mb-6 border-b border-border pb-5 text-center">
            <div className="eyebrow">Investment Policy Statement</div>
            <div className="mt-2 font-serif text-[30px] leading-tight">{h.name}</div>
            <div className="mt-1 text-[12.5px] text-muted-foreground">Prepared by {h.advisor}, Private Wealth Advisor · Risk profile: {ips.profile}</div>
          </div>

          <Article n="I" title="Purpose and scope">
            <p>This statement sets out the goals, constraints and rules for managing {policyAccounts.length} accounts worth {money(v.policy)} for the {h.name}. It gives the advisor clear, measurable guidelines and gives the family a standard for judging results.</p>
            {excluded.length > 0 && <p>It does not cover {excluded.map((a) => a.name).join(", ")}, which follow their own guidelines.</p>}
          </Article>

          <Article n="II" title="Investment objectives">
            {edit ? <textarea className="field h-20 py-2" value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} /> : <p>{ips.objective}</p>}
            <p>Target return: {edit ? num(draft.returnTarget, (x) => setDraft({ ...draft, returnTarget: x / 100 }), 0.25) : <b>{pct(ips.returnTarget)} a year after fees</b>}, measured over rolling five-year periods. The policy mix is expected to return {pct(policyStats.mean - ips.advisoryFee)} after the {pct(ips.advisoryFee, 2)} advisory fee, with {pct(policyStats.vol)} annual volatility.</p>
          </Article>

          <Article n="III" title="Risk tolerance">
            <p>The family&apos;s risk profile is <b>{ips.profile}</b>, based on the risk questionnaire and an assessment of their capacity to absorb losses. The portfolio should not be expected to lose more than {edit ? num(draft.limits.maxDrawdown, (x) => setLimit("maxDrawdown", x)) : <b>{pct(ips.limits.maxDrawdown, 0)}</b>} in a severe historical stress, and its expected volatility should stay below {edit ? num(draft.limits.maxVolatility, (x) => setLimit("maxVolatility", x)) : <b>{pct(ips.limits.maxVolatility, 0)}</b>}.</p>
          </Article>

          <Article n="IV" title="Time horizon"><p>{ips.timeHorizon}</p></Article>

          <Article n="V" title="Liquidity requirements">
            <p>Keep a cash reserve of at least {edit ? <input type="number" value={draft.liquidityMonths} onChange={(e) => setDraft({ ...draft, liquidityMonths: +e.target.value })} className="field-num h-7 w-16" /> : <b>{ips.liquidityMonths} months</b>} of household spending ({money((h.expenses / 12) * ips.liquidityMonths)}). {next5.length ? `Planned withdrawals over the next five years total ${money(-sum(next5.map((f) => f.amount)))}, for ${[...new Set(next5.map((f) => f.label))].join(", ").toLowerCase()}.` : "No withdrawals are planned in the next five years."}</p>
            <p>Illiquid investments (private equity, venture, investment real estate) are limited to {edit ? num(draft.limits.maxIlliquid, (x) => setLimit("maxIlliquid", x)) : <b>{pct(ips.limits.maxIlliquid, 0)}</b>} of investable net worth.</p>
          </Article>

          <Article n="VI" title="Tax considerations">{edit ? <textarea className="field h-20 py-2" value={draft.taxNotes} onChange={(e) => setDraft({ ...draft, taxNotes: e.target.value })} /> : <p>{ips.taxNotes}</p>}</Article>
          <Article n="VII" title="Legal and regulatory"><p>{ips.legalNotes}</p></Article>
          <Article n="VIII" title="Unique circumstances">{edit ? <textarea className="field h-20 py-2" value={draft.unique} onChange={(e) => setDraft({ ...draft, unique: e.target.value })} /> : <p>{ips.unique}</p>}</Article>

          <Article n="IX" title="Strategic asset allocation">
            <table className="grid-table mt-1">
              <thead><tr><th>Asset class</th><th className="r">Minimum</th><th className="r">Target</th><th className="r">Maximum</th><th>Benchmark</th></tr></thead>
              <tbody>
                {CLASSES.map((c) => {
                  const t = ips.targets.find((x) => x.cls === c) ?? { cls: c, target: 0, min: 0, max: 0 };
                  return (
                    <tr key={c}>
                      <td>{CLASS_LABEL[c]}</td>
                      <td className="r">{edit ? num(t.min, (x) => setTarget(c, "min", x)) : pct(t.min, 0)}</td>
                      <td className="r font-semibold">{edit ? num(t.target, (x) => setTarget(c, "target", x)) : pct(t.target, 0)}</td>
                      <td className="r">{edit ? num(t.max, (x) => setTarget(c, "max", x)) : pct(t.max, 0)}</td>
                      <td className="text-muted-foreground">{BENCH[c]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {edit && Math.abs(totalTarget - 1) > 0.001 && <p className="mt-2 text-[12px] text-neg">Targets add up to {pct(totalTarget)}; they must total 100% before saving.</p>}
            <p className="mt-3">Performance is measured against a blended benchmark of these indices at target weights.</p>
          </Article>

          <Article n="X" title="Rebalancing"><p>{ips.rebalancing}</p></Article>

          <Article n="XI" title="Risk limits">
            <ul className="list-disc space-y-1 pl-5">
              <li>No single security may exceed {edit ? num(draft.limits.maxPosition, (x) => setLimit("maxPosition", x)) : <b>{pct(ips.limits.maxPosition, 0)}</b>} of the portfolio. Diversified funds are exempt.</li>
              <li>Expected volatility at most {pct(ips.limits.maxVolatility, 0)}; loss in the worst historical stress no deeper than {pct(ips.limits.maxDrawdown, 0)}.</li>
              <li>No leverage, short sales or options other than covered calls on concentrated positions.</li>
            </ul>
          </Article>

          <Article n="XII" title="Spending policy"><p>{ips.spending}</p></Article>
          <Article n="XIII" title="Monitoring and review"><p>The advisor reports quarterly on performance against the benchmark, compliance with every limit in this statement, and progress toward the financial plan. The statement is reviewed at least once a year, or sooner after a major change in the family&apos;s circumstances.</p></Article>

          <Article n="XIV" title="Approval">
            <div className="mt-2 grid gap-6 sm:grid-cols-2">
              {[...ips.approvedBy.split(",").map((s) => s.trim()).filter(Boolean), h.advisor].map((name) => (
                <div key={name}><div className="h-8 border-b border-foreground/30" /><div className="mt-1 text-[12px] text-muted-foreground">{name}{name === h.advisor ? ", Advisor" : ""}</div></div>
              ))}
            </div>
          </Article>
        </div>
      </Panel>

      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Panel title="Live compliance" sub="Every rule in the policy, checked against today's portfolio">
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            {(["Compliant", "Watch", "Breach"] as Status[]).map((s) => (
              <div key={s} className="rounded-md border border-border bg-subtle py-2"><div className={`num text-[20px] font-semibold ${COLOR[s]}`}>{counts[s]}</div><div className="text-[11px] text-muted-foreground">{s}</div></div>
            ))}
          </div>
          <ul className="space-y-1">
            {checks.map((c, i) => {
              const Icon = ICON[c.status];
              return (
                <li key={i} className="flex gap-2.5 rounded-md px-1 py-1.5">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${COLOR[c.status]}`} />
                  <div className="min-w-0 flex-1 text-[12.5px]">
                    <div className="flex justify-between gap-3"><span>{c.rule}</span><span className="num shrink-0 font-medium">{c.actual}</span></div>
                    <div className="text-[11px] text-muted-foreground">{c.area}{c.detail ? ` · ${c.detail}` : ""}</div>
                  </div>
                </li>
              );
            })}
            {stress.loading && <li className="px-1 py-1.5 text-[12px] text-muted-foreground">Loading historical stress results…</li>}
          </ul>
        </Panel>
        <Panel title="Policy portfolio">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><div className="eyebrow">Expected return</div><div className="num mt-1 text-[18px] font-semibold">{pct(policyStats.mean - ips.advisoryFee)}</div></div>
            <div><div className="eyebrow">Volatility</div><div className="num mt-1 text-[18px] font-semibold">{pct(policyStats.vol)}</div></div>
          </div>
          <div className="mt-3"><Pill kind="gold">{ips.profile}</Pill></div>
        </Panel>
      </div>
    </div>
  );
}
