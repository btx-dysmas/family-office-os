"use client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader, Pill, Ring } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { holdingSymbols, useQuotes } from "@/lib/data";
import { ageOn, money, pct } from "@/lib/format";
import { clients, value } from "@/lib/household";
import { buildPlan, simulate } from "@/lib/montecarlo";
import { newHousehold, type Intake } from "@/lib/new-household";
import { actions, useBook } from "@/lib/store";

const BLANK: Intake = {
  family: "", state: "NY", filing: "mfj", profile: "Moderate",
  primary: { name: "", dob: "1980-01-01", income: 200_000, retireAge: 65 }, spouse: { name: "", dob: "1982-01-01", income: 0, retireAge: 65 },
  expenses: 120_000, savings: 40_000, retirementSpending: 110_000, taxable: 250_000, deferred: 400_000, roth: 50_000, cash: 60_000,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[11.5px] text-muted-foreground">{label}<div className="mt-1">{children}</div></label>;
}

function NewHousehold({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [f, setF] = useState<Intake>(BLANK);
  const quotes = useQuotes(open ? ["VTI", "VXUS", "BND", "VNQ", "GLD"] : []);
  const n = (v: number, on: (x: number) => void) => <input type="number" className="field-num" value={v} onChange={(e) => on(+e.target.value)} />;
  const submit = () => {
    const h = newHousehold(f, Object.fromEntries(Object.entries(quotes).map(([k, q]) => [k, q.price ?? 100])));
    actions.save(h);
    onOpenChange(false);
    router.push(`/households/${h.id}`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-serif text-[24px] font-normal">New household</DialogTitle></DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><Field label="Household name"><input className="field" placeholder="e.g. The Patel Family" value={f.family} onChange={(e) => setF({ ...f, family: e.target.value })} /></Field></div>
            <Field label="State"><input className="field" maxLength={2} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} /></Field>
            <Field label="Filing status"><select className="field" value={f.filing} onChange={(e) => setF({ ...f, filing: e.target.value as Intake["filing"] })}><option value="mfj">Married, joint</option><option value="single">Single</option><option value="hoh">Head of household</option></select></Field>
          </div>
          {(["primary", "spouse"] as const).map((k) => (
            <div key={k}>
              <div className="eyebrow mb-2">{k === "primary" ? "Primary client" : "Spouse or partner (optional)"}</div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Name"><input className="field" value={f[k]!.name} onChange={(e) => setF({ ...f, [k]: { ...f[k]!, name: e.target.value } })} /></Field>
                <Field label="Date of birth"><input type="date" className="field" value={f[k]!.dob} onChange={(e) => setF({ ...f, [k]: { ...f[k]!, dob: e.target.value } })} /></Field>
                <Field label="Annual income">{n(f[k]!.income, (x) => setF({ ...f, [k]: { ...f[k]!, income: x } }))}</Field>
                <Field label="Retirement age">{n(f[k]!.retireAge, (x) => setF({ ...f, [k]: { ...f[k]!, retireAge: x } }))}</Field>
              </div>
            </div>
          ))}
          <div>
            <div className="eyebrow mb-2">Cash flow</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Living expenses / yr">{n(f.expenses, (x) => setF({ ...f, expenses: x }))}</Field>
              <Field label="Savings / yr">{n(f.savings, (x) => setF({ ...f, savings: x }))}</Field>
              <Field label="Retirement spending / yr">{n(f.retirementSpending, (x) => setF({ ...f, retirementSpending: x }))}</Field>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">Assets (invested in the model portfolio for the chosen profile)</div>
            <div className="grid gap-3 sm:grid-cols-5">
              <Field label="Taxable">{n(f.taxable, (x) => setF({ ...f, taxable: x }))}</Field>
              <Field label="401(k) / IRA">{n(f.deferred, (x) => setF({ ...f, deferred: x }))}</Field>
              <Field label="Roth">{n(f.roth, (x) => setF({ ...f, roth: x }))}</Field>
              <Field label="Cash">{n(f.cash, (x) => setF({ ...f, cash: x }))}</Field>
              <Field label="Risk profile"><select className="field" value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value as Intake["profile"] })}><option>Conservative</option><option>Moderate</option><option>Aggressive</option></select></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!f.family.trim() || !f.primary.name.trim()} onClick={submit}>Create household</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Households() {
  const { households } = useBook();
  const quotes = useQuotes(useMemo(() => holdingSymbols(households), [households]));
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => households.map((h) => { const v = value(h, quotes); return { h, v, mc: simulate(buildPlan(h, v), 2000) }; }), [households, quotes]);

  return (
    <>
      <PageHeader eyebrow="Book of business" title="Households" sub="Every family's complete financial picture: balance sheet, entities, policy, plan and relationship."
        actions={<Button onClick={() => setOpen(true)}><Plus /> New household</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ h, v, mc }) => (
          <Link key={h.id} href={`/households/${h.id}`} className="panel group flex gap-5 p-5 transition-colors hover:border-gold/40">
            <Ring value={mc.success} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-serif text-[24px] leading-tight group-hover:text-gold">{h.name}</div><div className="text-[12px] text-muted-foreground">{clients(h).map((p) => `${p.name.split(",")[0]} (${ageOn(p.dob)})`).join(" · ")}</div></div>
                <Pill kind="gold">{h.ips.profile}</Pill>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
                <div><div className="text-muted-foreground">Net worth</div><div className="num text-[15px] font-semibold">{money(v.netWorth)}</div></div>
                <div><div className="text-muted-foreground">Invested</div><div className="num text-[15px] font-semibold">{money(v.policy)}</div></div>
                <div><div className="text-muted-foreground">Goals on track</div><div className="num text-[15px] font-semibold">{h.goals.filter((g) => (g.type === "retirement" ? mc.success : mc.probability[g.id] ?? 1) >= 0.8).length}/{h.goals.length}</div></div>
              </div>
              <div className="mt-3 text-[12px] text-muted-foreground">{h.tier} · {h.state} · {h.accounts.length} accounts · {h.entities.length} entities · retirement {pct(mc.success, 0)}</div>
            </div>
          </Link>
        ))}
      </div>
      <NewHousehold open={open} onOpenChange={setOpen} />
    </>
  );
}
