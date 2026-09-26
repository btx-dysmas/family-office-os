"use client";
import { FileText, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { analyze, type Prices } from "@/lib/analytics";
import { donut, fan } from "@/lib/charts";
import { CLASS_COLOR, CLASS_LABEL, CLASSES } from "@/lib/cma";
import { useApi } from "@/lib/data";
import { money, pct, today } from "@/lib/format";
import { useHH } from "@/lib/household-context";
import { compliance } from "@/lib/ips";
import { clientReport } from "@/lib/pdf";
import { classify } from "@/lib/regime";
import { heatMap } from "@/lib/risk";
import { useLookThrough } from "@/lib/use-lookthrough";
import { useStress } from "@/lib/use-stress";

const SECTIONS = [
  ["Client summary", "Net worth, balance sheet, liquidity and debt"],
  ["Goals", "Every goal with its Monte Carlo probability"],
  ["Portfolio", "Allocation against IPS targets, performance against the S&P 500"],
  ["Risk", "Risk profile, expected volatility, heat map and historical stress tests"],
  ["Planning", "Wealth projection fan chart and Monte Carlo outcomes"],
  ["Policy compliance", "Every rule in the investment policy statement"],
  ["Economic environment", "Current regime and what it means for each asset class"],
  ["Disclosures", "Assumptions and data sources"],
];

export default function Report() {
  const { h, v, mc, plan, macro } = useHH();
  const [busy, setBusy] = useState(false);
  const symbols = [...new Set(v.positions.map((p) => p.symbol).filter((s) => s !== "$CASH"))].sort().join(",");
  const { data: prices } = useApi<Prices>(`/api/prices?range=3y&symbols=${symbols}`);
  const analysis = useMemo(() => (prices ? analyze(v, prices, 756, (macro?.rates.tbill ?? 4) / 100) : null), [prices, v, macro]);
  const stress = useStress(v.policyWeights);
  const lt = useLookThrough(v);
  const checks = compliance(h, v, stress.worst);
  const ready = !!prices && !stress.loading && lt.loaded;

  const generate = async () => {
    setBusy(true);
    try {
      await clientReport(h, v, {
        mc, checks, heat: heatMap(h, v, { retirementProbability: mc.success, cpi: macro?.series.CPIAUCSL?.latest?.[1], techShare: lt.techShare }),
        stress: stress.results.map((x) => ({ name: x.name, worst: x.worst })), analysis, regime: macro?.available ? classify(macro.series, today()) : null,
        figs: {
          allocation: donut(CLASSES.map((c) => CLASS_LABEL[c]), CLASSES.map((c) => v.policyWeights[c]), CLASSES.map((c) => CLASS_COLOR[c]), money(v.policy)),
          fan: fan(mc.years, mc.bands, { x: plan.retireYear, label: "Retirement" }),
        },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title="Client review report" sub="A formatted PDF the family can keep, generated from today's numbers">
        <ol className="grid gap-3 sm:grid-cols-2">
          {SECTIONS.map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-lg border border-border bg-subtle p-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-md bg-gold/10 text-[12px] text-gold ring-1 ring-gold/30">{i + 1}</span>
              <div><div className="text-[13.5px] font-medium">{t}</div><div className="text-[12px] text-muted-foreground">{d}</div></div>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Generate">
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Net worth</span><span className="num">{money(v.netWorth)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Retirement probability</span><span className="num">{pct(mc.success, 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Policy breaches</span><span>{checks.filter((c) => c.status === "Breach").length ? <Pill kind="Breach">{checks.filter((c) => c.status === "Breach").length}</Pill> : <Pill kind="Compliant">None</Pill>}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Performance data</span><span>{prices ? "3 years loaded" : "Loading…"}</span></div>
        </div>
        <Button className="mt-5 w-full" size="lg" disabled={busy || !ready} onClick={generate}>{busy ? <Loader2 className="animate-spin" /> : <FileText />}{busy ? "Building PDF" : ready ? "Download PDF report" : "Loading data"}</Button>
        <p className="mt-3 text-[12px] text-muted-foreground">Built in the browser with jsPDF; charts are rendered in a print-friendly light theme. Nothing is uploaded.</p>
      </Panel>
    </div>
  );
}
