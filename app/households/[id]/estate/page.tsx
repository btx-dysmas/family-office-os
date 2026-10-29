"use client";
import { useState } from "react";
import { KV, Note, Panel, Stat } from "@/components/kit";
import Plot from "@/components/Plot";
import { C, sankey } from "@/lib/charts";
import { money, pct, usd } from "@/lib/format";
import { ENTITY_LABEL, inEstate } from "@/lib/household";
import { useHH } from "@/lib/household-context";
import { estate } from "@/lib/planning";
import { ESTATE } from "@/lib/reference";

export default function Estate() {
  const { h, v, plan } = useHH();
  const heirs = h.people.filter((p) => p.relationship === "child" || p.relationship === "grandchild" || p.relationship === "other");
  const children = h.people.filter((p) => p.relationship === "child");
  const [o, setO] = useState({ giftingYears: 10, donees: heirs.length, charitable: 0, trustTransfer: 0 });
  const e = estate(h, v, plan, o);
  const b = e.baseline, s = e.strategy;
  const outsideEntities = h.entities.filter((x) => !inEstate(h, x.id) && x.type !== "529");
  const direct = children.length ? children : heirs;

  const nodes = ["Estate at death", "Irrevocable trusts and gifts", "Estate tax", "Charity", ...direct.map((p) => p.name.split(" ")[0])];
  const heirsNet = s.toHeirs - s.outsideEstate;
  const each = direct.length ? 1 / direct.length : 1;
  const links = [
    { s: 0, t: 2, v: s.tax, color: "rgba(239,107,107,0.35)" },
    { s: 0, t: 3, v: s.toCharity, color: "rgba(165,139,234,0.35)" },
    ...direct.map((_, i) => ({ s: 0, t: 4 + i, v: heirsNet * each, color: "rgba(111,156,246,0.28)" })),
    ...direct.map((_, i) => ({ s: 1, t: 4 + i, v: s.outsideEstate * each, color: "rgba(214,182,118,0.3)" })),
  ].filter((l) => l.v > 1);

  const field = (label: string, key: keyof typeof o, step: number, pctField = false) => (
    <label className="text-[11.5px] text-muted-foreground">{label}
      <input type="number" step={step} className="field-num mt-1" value={pctField ? +(o[key] * 100).toFixed(1) : o[key]} onChange={(ev) => setO({ ...o, [key]: pctField ? +ev.target.value / 100 : +ev.target.value })} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Taxable estate today" value={money(v.estate)} sub={`${money(e.excluded)} already outside the estate`} />
        <Stat label="Federal exclusion" value={money(e.exclusion - e.used)} sub={`${e.married ? "Two exclusions of $15M with portability" : "One $15M exclusion"}${e.used ? `, less ${money(e.used)} used by earlier gifts` : ""}`} />
        <Stat label="Projected estate tax" value={money(b.tax)} tone={b.tax > 0 ? "neg" : "pos"} sub={`At the second death, ${e.deathYear}, with no planning`} />
        <Stat label="Tax saved by strategy" value={money(b.tax - s.tax)} tone={b.tax - s.tax > 0 ? "pos" : undefined} sub={s.toHeirs >= b.toHeirs ? `Heirs receive ${money(s.toHeirs - b.toHeirs)} more` : `Heirs receive ${money(b.toHeirs - s.toHeirs)} less; charity receives ${money(s.toCharity)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="Transfer strategy" sub="Adjust and compare with doing nothing">
          <div className="grid grid-cols-2 gap-3">
            {field("Years of annual gifts", "giftingYears", 1)}
            {field("Number of recipients", "donees", 1)}
            {field("Charitable bequest (%)", "charitable", 5, true)}
            {field("Transfer to irrevocable trust now ($)", "trustTransfer", 100000)}
          </div>
          <KV className="mt-4" rows={[
            ["Annual exclusion gifts", `${usd(e.annualGift)}/yr`],
            ["Per recipient, per donor", usd(ESTATE.annualGift)],
            ["Growth assumed (real, median)", pct(e.rate, 2)],
            ["Years until transfer", String(e.years)],
          ]} />
          <Note>Annual exclusion gifts ({usd(ESTATE.annualGift)} per donor per recipient in 2026) leave the estate without using any of the lifetime exclusion, and their growth accrues to heirs outside it. A transfer to an irrevocable trust today uses the same amount of exclusion, so its benefit is the growth that happens outside the estate; any part above the remaining exclusion owes 40% gift tax now. The estate tax rate is 40% above the exclusion.</Note>
        </Panel>

        <Panel title="Where the estate goes" sub={`Strategy case at ${e.deathYear}, in today's dollars`}>
          <Plot fig={sankey(nodes, [C.c1, C.gold, C.neg, C.c5, ...direct.map(() => C.c2)], links)} height={330} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Comparison" pad={false}>
          <table className="grid-table">
            <thead><tr><th /><th className="r">No planning</th><th className="r">With strategy</th><th className="r">Difference</th></tr></thead>
            <tbody>
              {([
                ["Estate at death", b.gross, s.gross], ["Charitable bequests", b.toCharity, s.toCharity], ["Taxable estate", b.taxable, s.taxable],
                ["Federal estate tax", b.tax, s.tax], ["Assets outside the estate", b.outsideEstate, s.outsideEstate], ["Total to heirs", b.toHeirs, s.toHeirs],
              ] as const).map(([k, x, y]) => (
                <tr key={k} className={k === "Total to heirs" ? "font-semibold" : ""}>
                  <td>{k}</td><td className="r">{money(x)}</td><td className="r">{money(y)}</td>
                  <td className={`r ${k === "Federal estate tax" ? (y < x ? "text-pos" : "") : y > x ? "text-pos" : y < x ? "text-neg" : "text-muted-foreground"}`}>{y - x >= 0 ? "+" : ""}{money(y - x)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 pb-4"><Note>Projection grows the estate at the plan&apos;s median real return until the later of the two planning ages and holds the exclusion constant in real terms (it is indexed to inflation from 2027). Savings, retirement spending (after tax) and goals follow the same year-by-year cash flows as the goal plan, at its median return. State estate taxes, such as Connecticut&apos;s, are not modeled.</Note></div>
        </Panel>

        <Panel title="Beneficiaries and vehicles">
          <div className="eyebrow mb-2">Heirs</div>
          <ul className="mb-4 space-y-1.5 text-[13px]">
            {heirs.map((p) => <li key={p.id} className="flex justify-between gap-3"><span>{p.name}</span><span className="text-muted-foreground">{p.relationship}{p.note ? ` · ${p.note}` : ""}</span></li>)}
            {!heirs.length && <li className="text-muted-foreground">No heirs recorded.</li>}
          </ul>
          <div className="eyebrow mb-2">Vehicles outside the estate</div>
          <ul className="space-y-2 text-[13px]">
            {outsideEntities.map((x) => (
              <li key={x.id}><div className="flex justify-between gap-3"><span>{x.name}</span><span className="num">{money(v.entityValue(x.id))}</span></div><div className="text-[11.5px] text-muted-foreground">{ENTITY_LABEL[x.type]}{x.beneficiaries ? ` · for ${x.beneficiaries}` : ""}</div></li>
            ))}
            {!outsideEntities.length && <li className="text-muted-foreground">None yet. Consider a dynasty trust or spousal lifetime access trust if the estate exceeds the exclusion.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
