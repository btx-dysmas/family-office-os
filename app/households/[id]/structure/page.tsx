"use client";
import { KV, Panel, Pill } from "@/components/kit";
import { money, pct } from "@/lib/format";
import { ENTITY_LABEL, inEstate } from "@/lib/household";
import { useHH } from "@/lib/household-context";
import type { Entity } from "@/lib/types";

const TAX_NOTE: Record<Entity["type"], string> = {
  individual: "Owned outright; in the estate; passes by beneficiary designation or will.",
  joint: "Joint tenancy with right of survivorship; passes to the survivor outside probate.",
  "revocable-trust": "Grantor keeps control; in the estate; avoids probate and provides incapacity planning.",
  "irrevocable-trust": "Completed gift; outside the estate; trustee manages for beneficiaries.",
  llc: "Pass-through entity; value follows its owner. Useful for liability protection and valuation discounts.",
  foundation: "Private foundation; tax-exempt; must distribute at least 5% of assets a year.",
  daf: "Donor-advised fund; deduction taken at contribution; grants recommended over time.",
  custodial: "Irrevocable gift to a minor; transfers to the child at the age of majority.",
  "529": "Tax-free growth for education; owner keeps control; outside the estate.",
};

export default function Structure() {
  const { h, v } = useHH();
  const roots = h.entities.filter((e) => !e.parent);
  const children = (id: string) => h.entities.filter((e) => e.parent === id);
  const inside = h.entities.filter((e) => inEstate(h, e.id));
  const outside = h.entities.filter((e) => !inEstate(h, e.id));

  const Node = ({ e, depth = 0 }: { e: Entity; depth?: number }) => (
    <div className={depth ? "ml-8 border-l border-border pl-5" : ""}>
      <div className="relative my-2 rounded-lg border border-border bg-subtle p-3.5">
        {depth > 0 && <span className="absolute top-1/2 -left-5 h-px w-5 bg-border" />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-medium">{e.name}</div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">{ENTITY_LABEL[e.type]}{e.trustee ? ` · Trustee: ${e.trustee}` : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <Pill kind={inEstate(h, e.id) ? "neutral" : "gold"}>{inEstate(h, e.id) ? "In estate" : "Outside estate"}</Pill>
            <span className="num text-[14px] font-semibold">{money(v.entityValue(e.id))}</span>
          </div>
        </div>
        {e.beneficiaries && <div className="mt-1.5 text-[12px] text-muted-foreground">Beneficiaries: {e.beneficiaries}</div>}
        {e.note && <div className="mt-1 text-[12px] text-muted-foreground">{e.note}</div>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {h.accounts.filter((a) => a.entity === e.id).map((a) => <span key={a.id} className="rounded bg-raised px-2 py-0.5 text-[11px] text-muted-foreground">{a.name}</span>)}
          {h.other.filter((o) => o.entity === e.id).map((o) => <span key={o.id} className="rounded bg-raised px-2 py-0.5 text-[11px] text-gold/80">{o.name}</span>)}
        </div>
      </div>
      {children(e.id).map((c) => <Node key={c.id} e={c} depth={depth + 1} />)}
    </div>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title="Household entity structure" sub="Who owns what. Values are net of liabilities held by each entity.">
        <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
          <div className="text-[14px] font-medium">{h.name}</div>
          <div className="text-[12px] text-muted-foreground">{h.people.filter((p) => p.relationship === "client" || p.relationship === "spouse").map((p) => p.name).join(" and ")} · Net worth {money(v.netWorth)}</div>
        </div>
        <div className="ml-4 border-l border-gold/30 pl-4">
          {roots.map((e) => <Node key={e.id} e={e} />)}
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel title="Estate inclusion">
          <KV rows={[
            ["Inside the taxable estate", money(v.estate)],
            ["Outside the estate", money(v.netWorth - v.estate)],
            ["Share outside the estate", pct((v.netWorth - v.estate) / v.netWorth)],
            ["Entities in the estate", String(inside.length)],
            ["Entities outside the estate", String(outside.length)],
          ]} />
        </Panel>
        <Panel title="How each entity is treated">
          <ul className="space-y-3 text-[12.5px]">
            {[...new Set(h.entities.map((e) => e.type))].map((t) => (
              <li key={t}><div className="font-medium">{ENTITY_LABEL[t]}</div><div className="text-muted-foreground">{TAX_NOTE[t]}</div></li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
