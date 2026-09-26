"use client";
import { useMemo, useState } from "react";
import { Loading, Meter, Note, Panel, Pill } from "@/components/kit";
import Plot from "@/components/Plot";
import { Button } from "@/components/ui/button";
import { HeatGrid } from "@/components/widgets";
import { C, donut, pctLines } from "@/lib/charts";
import { band, CLASS_COLOR, CLASS_LABEL, CLASSES, DURATION } from "@/lib/cma";
import { money, pct } from "@/lib/format";
import { useHH } from "@/lib/household-context";
import { assess, heatMap, QUESTIONS } from "@/lib/risk";
import { HYPOTHETICAL } from "@/lib/stress";
import { useLookThrough } from "@/lib/use-lookthrough";
import { useStress } from "@/lib/use-stress";
import { cn } from "@/lib/utils";

export default function Risk() {
  const { h, v, mc, macro, update } = useHH();
  const [answers, setAnswers] = useState<Record<string, number>>(h.riskAnswers ?? {});
  const r = assess(answers, h, v, mc.success);
  const lt = useLookThrough(v);
  const heat = heatMap(h, v, { retirementProbability: mc.success, cpi: macro?.series.CPIAUCSL?.latest?.[1], techShare: lt.techShare });
  const stress = useStress(v.policyWeights);
  const [sel, setSel] = useState("gfc");
  const picked = stress.results.find((x) => x.id === sel);
  const bonds = v.positions.filter((p) => p.account.inPolicy && p.cls === "bonds");
  const bondValue = bonds.reduce((s, p) => s + p.value, 0);
  const duration = bondValue ? bonds.reduce((s, p) => s + p.value * (DURATION[p.symbol] ?? 6), 0) / bondValue : 6;
  const hypo = useMemo(() => HYPOTHETICAL.map((x) => {
    const shock = x.shock(duration);
    return { ...x, ret: CLASSES.reduce((s, c) => s + v.policyWeights[c] * shock[c], 0) };
  }), [duration, v.policyWeights]);
  const limit = h.ips.limits.maxDrawdown;
  const apply = () => update((x) => ({
    ...x, riskAnswers: answers,
    ips: { ...x.ips, profile: r.profile, targets: CLASSES.map((c) => ({ cls: c, target: r.allocation[c], min: Math.max(0, +(r.allocation[c] - band(r.allocation[c])).toFixed(2)), max: +(r.allocation[c] + band(r.allocation[c])).toFixed(2) })) },
  }));

  return (
    <div className="space-y-4">
      <Panel title="Household risk heat map" sub="Ten dimensions scored 1 (low) to 5 (high) from explicit rules; each card names its driver">
        <HeatGrid cells={heat} />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Historical stress tests" sub="Today's allocation replayed through real crises, using long-history index funds for each asset class">
          {stress.loading ? <Loading label="Loading historical returns" /> : (
            <>
              <table className="grid-table">
                <thead><tr><th>Scenario</th><th>Window</th><th className="r">Portfolio</th><th className="r">Dollar impact</th><th className="r">Recovery</th><th /></tr></thead>
                <tbody>
                  {stress.results.map((x) => (
                    <tr key={x.id} onClick={() => setSel(x.id)} className={cn("cursor-pointer", sel === x.id && "[&>td]:bg-raised")}>
                      <td className="min-w-[260px]"><div className="font-medium">{x.name}</div><div className="text-[11.5px] text-muted-foreground">{x.blurb}</div></td>
                      <td className="text-[12px] whitespace-nowrap text-muted-foreground">{x.start.slice(0, 7)} to {x.end.slice(0, 7)}</td>
                      <td className={`r font-semibold ${x.worst < -limit ? "text-neg" : x.worst < 0 ? "text-warn" : "text-pos"}`}>{pct(x.worst)}</td>
                      <td className="r">{money(x.worst * v.policy)}</td>
                      <td className="r text-muted-foreground">{x.recoveryMonths != null ? `${x.recoveryMonths} mo` : "Beyond window"}</td>
                      <td>{x.worst < -limit ? <Pill kind="Breach">Over limit</Pill> : <Pill kind="Compliant">Within limit</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {picked && <div className="mt-4"><Plot fig={pctLines(picked.dates, [{ name: `${picked.name}: portfolio value`, y: picked.level.map((x) => x - 1), color: C.c1, fill: true }])} height={220} /></div>}
              <Note>Worst point is the deepest decline inside the window; recovery is months from the start until the portfolio regained its starting value. Proxies: Vanguard 500 Index, Total International Stock, Total Bond Market, REIT Index and Short-Term Treasury funds, and gold futures. The IPS limit is a {pct(limit, 0)} loss.</Note>
            </>
          )}
        </Panel>

        <Panel title="Hypothetical shocks" sub="Instant shocks applied to each asset class">
          <ul className="space-y-3">
            {hypo.map((x) => (
              <li key={x.id} className="rounded-lg border border-border bg-subtle p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium">{x.name}</span>
                  <span className={`num text-[15px] font-semibold ${x.ret < 0 ? "text-neg" : "text-pos"}`}>{pct(x.ret)} · {money(x.ret * v.policy)}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{x.blurb}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {CLASSES.map((c) => <span key={c}>{CLASS_LABEL[c]} {pct(x.shock(duration)[c], 0, true)}</span>)}
                </div>
              </li>
            ))}
          </ul>
          <Note>Bond losses in the rate shock use the portfolio&apos;s weighted duration of {duration.toFixed(1)} years (loss ≈ duration × rate change).</Note>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Risk tolerance questionnaire" sub="Willingness to take risk">
          <ol className="space-y-4">
            {QUESTIONS.map((q, i) => (
              <li key={q.id}>
                <div className="text-[13px] font-medium"><span className="num mr-2 text-muted-foreground">{i + 1}.</span>{q.q}</div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((opt, k) => (
                    <button key={k} onClick={() => setAnswers({ ...answers, [q.id]: k })}
                      className={cn("rounded-md border px-3 py-2 text-left text-[12.5px] transition-colors", answers[q.id] === k ? "border-gold/60 bg-gold/10 text-foreground" : "border-border bg-subtle text-muted-foreground hover:text-foreground")}>
                      {opt}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Risk profile" sub="Final profile is the more conservative of willingness and capacity"
          action={<Button size="sm" disabled={r.profile === h.ips.profile && JSON.stringify(answers) === JSON.stringify(h.riskAnswers)} onClick={apply}>Apply to IPS</Button>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-subtle p-3"><div className="eyebrow">Willingness</div><div className="num mt-1 text-[24px] font-semibold">{r.willingness}</div><Meter value={r.willingness / 100} className="mt-2" /><div className="mt-1 text-[11.5px] text-muted-foreground">{r.willingnessProfile}</div></div>
            <div className="rounded-lg border border-border bg-subtle p-3"><div className="eyebrow">Capacity</div><div className="num mt-1 text-[24px] font-semibold">{r.capacity}</div><Meter value={r.capacity / 100} color="var(--c2)" className="mt-2" /><div className="mt-1 text-[11.5px] text-muted-foreground">{r.capacityProfile}</div></div>
          </div>
          <ul className="mt-3 space-y-1 text-[12px]">
            {r.parts.map((p) => <li key={p.name} className="flex justify-between gap-3"><span className="text-muted-foreground">{p.name}: {p.note}</span><span className="num">{Math.round(p.score)}</span></li>)}
          </ul>
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-gold/10 px-4 py-3 ring-1 ring-gold/30">
            <span className="eyebrow">Recommended profile</span><span className="font-serif text-[24px]">{r.profile}</span>
            {r.profile !== h.ips.profile && <Pill kind="Watch">IPS is {h.ips.profile}</Pill>}
          </div>
          <div className="mt-3 grid grid-cols-[140px_1fr] items-center gap-3">
            <Plot fig={donut(CLASSES.map((c) => CLASS_LABEL[c]), CLASSES.map((c) => r.allocation[c]), CLASSES.map((c) => CLASS_COLOR[c]))} height={140} />
            <ul className="space-y-1 text-[12.5px]">{CLASSES.map((c) => <li key={c} className="flex justify-between"><span>{CLASS_LABEL[c]}</span><span className="num text-muted-foreground">{pct(r.allocation[c], 0)}</span></li>)}</ul>
          </div>
          <Note>Scores run 0–100: below 40 is Conservative, 40–69 Moderate, 70 and above Aggressive. Capacity averages time horizon, cash reserve, plan cushion and debt load. Applying updates the IPS profile and targets with standard ranges.</Note>
        </Panel>
      </div>
    </div>
  );
}
