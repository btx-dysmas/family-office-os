"use client";
import { Download } from "lucide-react";
import { Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { brief, type Point } from "@/lib/brief";
import { date, today } from "@/lib/format";
import { clients } from "@/lib/household";
import { useHH } from "@/lib/household-context";
import { compliance, harvest, rebalance } from "@/lib/ips";
import { meetingBrief } from "@/lib/pdf";
import { classify } from "@/lib/regime";
import { timeline } from "@/lib/timeline";
import { useStress } from "@/lib/use-stress";

const DOT: Record<Point["tone"], string> = { pos: "bg-pos", neg: "bg-neg", warn: "bg-warn", info: "bg-c1" };

function Points({ items }: { items: Point[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((p, i) => <li key={i} className="flex gap-3 text-[13.5px]"><span className={`mt-2 size-1.5 shrink-0 rounded-full ${DOT[p.tone]}`} />{p.text}</li>)}
      {!items.length && <li className="text-[13px] text-muted-foreground">Nothing to raise.</li>}
    </ul>
  );
}

export default function Meeting() {
  const { h, v, mc, macro } = useHH();
  const stress = useStress(v.policyWeights);
  const b = brief(h, v, {
    mc, checks: compliance(h, v, stress.worst), rebalance: rebalance(h, v), harvest: harvest(h, v), milestones: timeline(h),
    regime: macro?.available ? classify(macro.series, today()) : null,
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel title="Meeting brief" sub={`${h.nextMeeting ? `Review on ${date(h.nextMeeting)}` : "No meeting scheduled"} · Attendees: ${clients(h).map((p) => p.name).join(", ")}, ${h.advisor}`}
        action={<Button size="sm" variant="outline" onClick={() => meetingBrief(h, { ...b, recent: b.recent })}><Download /> PDF</Button>}>
        <div className="eyebrow mb-3">Discussion topics</div>
        <Points items={b.topics} />
        {b.personal.length > 0 && <><div className="eyebrow mt-6 mb-3">Personal</div><Points items={b.personal} /></>}
        <p className="mt-6 text-[12px] text-muted-foreground">Generated from the household&apos;s live numbers: plan results against the last review, IPS compliance, drift, tax-loss opportunities, timeline milestones and the economic regime. Every point links back to a figure elsewhere in the platform.</p>
      </Panel>
      <div className="space-y-4">
        <Panel title="Agenda">
          <ol className="space-y-2">
            {b.agenda.map((a, i) => <li key={a} className="flex gap-3 text-[13.5px]"><span className="num grid size-6 shrink-0 place-items-center rounded-full bg-raised text-[11px] text-gold ring-1 ring-border">{i + 1}</span>{a}</li>)}
          </ol>
        </Panel>
        <Panel title="Open follow-ups"><Points items={b.followUps} /></Panel>
        <Panel title="Recent activity">
          <ul className="space-y-3">
            {b.recent.map((n) => <li key={n.id} className="text-[13px]"><div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">{date(n.date)}<Pill>{n.category}</Pill></div>{n.summary}</li>)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
