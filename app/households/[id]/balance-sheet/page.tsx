"use client";
import { Building, Gem, Home, Landmark, Plane, Rocket, Store, type LucideIcon } from "lucide-react";
import { KV, Panel, Pill, Stat } from "@/components/kit";
import Plot from "@/components/Plot";
import { donut, SERIES } from "@/lib/charts";
import { CLASS_COLOR, CLASS_LABEL, CLASSES } from "@/lib/cma";
import { date, daysUntil, money, pct, sum, usd } from "@/lib/format";
import { ENTITY_LABEL, inEstate, KIND_LABEL } from "@/lib/household";
import { useHH } from "@/lib/household-context";
import type { OtherAssetKind } from "@/lib/types";

const KIND_ICON: Record<OtherAssetKind, LucideIcon> = { residence: Home, "real-estate": Building, "private-equity": Landmark, venture: Rocket, business: Store, art: Gem, aircraft: Plane, other: Store };
const LIAB_LABEL = { mortgage: "Mortgage", "student-loan": "Student loan", "credit-line": "Credit line", auto: "Auto loan", other: "Other" };

export default function BalanceSheet() {
  const { h, v } = useHH();
  const entity = (id: string) => h.entities.find((e) => e.id === id);
  const byClass = CLASSES.map((c) => sum(v.positions.filter((p) => p.cls === c).map((p) => p.value)));
  const composition: [string, number, string][] = [
    ...CLASSES.map((c, i) => [CLASS_LABEL[c], byClass[i], CLASS_COLOR[c]] as [string, number, string]),
    ...v.byKind.map(([k, val], i) => [k, val, SERIES[(i + 2) % SERIES.length] + "99"] as [string, number, string]),
  ].filter((r) => r[1] > 0);
  const annualDebtService = v.ratios.debtService * 12;
  const incomeProducing = sum(h.other.map((o) => o.income ?? 0));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Net worth" value={money(v.netWorth)} sub={`${money(v.estate)} inside the taxable estate`} />
        <Stat label="Total assets" value={money(v.assets)} sub={`${money(v.liquid)} liquid, ${money(v.otherTotal)} real and private`} />
        <Stat label="Liabilities" value={money(v.debt)} sub={`${usd(annualDebtService)} a year in payments`} />
        <Stat label="Debt ratio" value={pct(v.ratios.debtToAssets)} sub="Liabilities ÷ total assets" tone={v.ratios.debtToAssets > 0.35 ? "warn" : undefined} />
        <Stat label="Liquidity ratio" value={`${v.ratios.liquidityMonths.toFixed(1)} mo`} sub={`Cash ÷ monthly spending of ${usd(h.expenses / 12)}`} tone={v.ratios.liquidityMonths < h.ips.liquidityMonths ? "warn" : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Panel title="Asset composition" sub="Liquid investments by asset class, plus real and private assets">
          <Plot fig={donut(composition.map((r) => r[0]), composition.map((r) => r[1]), composition.map((r) => r[2]), money(v.assets))} height={220} />
          <ul className="mt-3 space-y-1.5 text-[12.5px]">
            {composition.map(([k, val, c]) => (
              <li key={k} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: c }} />{k}</span><span className="num text-muted-foreground">{money(val)} · {pct(val / v.assets, 0)}</span></li>
            ))}
          </ul>
        </Panel>

        <Panel title="Investment accounts" sub={`${h.accounts.length} accounts at ${new Set(h.accounts.map((a) => a.custodian)).size} custodians`} pad={false}>
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead><tr><th>Account</th><th>Owner</th><th>Custodian</th><th>Tax treatment</th><th>Policy</th><th>Statement</th><th className="r">Value</th><th className="r">Share</th></tr></thead>
              <tbody>
                {[...v.accounts].sort((a, b) => b.value - a.value).map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.name}</td>
                    <td className="text-muted-foreground">{entity(a.entity)?.name}</td>
                    <td className="text-muted-foreground">{a.custodian}</td>
                    <td><Pill kind={a.tax === "taxable" ? "neutral" : "Moderate"}>{a.tax.replace("-", " ")}</Pill></td>
                    <td>{a.inPolicy ? <Pill kind="gold">IPS</Pill> : <span className="text-[12px] text-muted-foreground">Separate</span>}</td>
                    <td className={`text-[12px] whitespace-nowrap ${a.asOf && -daysUntil(a.asOf) > 45 ? "text-warn" : "text-muted-foreground"}`} title="Holdings as of this date; priced at the latest close">{a.asOf ? date(a.asOf) : "—"}</td>
                    <td className="r">{usd(a.value)}</td>
                    <td className="r text-muted-foreground">{pct(a.value / v.liquid)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={6} className="px-3 py-2.5 font-medium">Total liquid assets</td><td className="r px-3 font-semibold">{usd(v.liquid)}</td><td /></tr></tfoot>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Real and private assets" sub={h.other.length ? `${money(v.otherTotal)} across ${h.other.length} holdings${incomeProducing ? `, producing ${money(incomeProducing)} a year` : ""}` : "None recorded"}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {h.other.map((o) => {
            const Icon = KIND_ICON[o.kind];
            return (
              <div key={o.id} className="rounded-lg border border-border bg-subtle p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-md bg-gold/10 ring-1 ring-gold/25"><Icon className="size-4 text-gold" /></span>
                    <div><div className="text-[13.5px] font-medium">{o.name}</div><div className="text-[11.5px] text-muted-foreground">{KIND_LABEL[o.kind]} · {entity(o.entity)?.name}</div></div>
                  </div>
                  <div className="num text-right text-[15px] font-semibold">{money(o.value)}</div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                  <span>Valued {date(o.asOf)}</span>
                  {o.income ? <Pill kind="Low">{money(o.income)}/yr income</Pill> : null}
                  <Pill kind={inEstate(h, o.entity) ? "neutral" : "gold"}>{inEstate(h, o.entity) ? "In estate" : "Outside estate"}</Pill>
                </div>
                {o.note && <p className="mt-2 text-[12px] text-muted-foreground">{o.note}</p>}
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Liabilities" pad={false}>
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead><tr><th>Liability</th><th>Type</th><th>Borrower</th><th className="r">Balance</th><th className="r">Rate</th><th className="r">Payment / mo</th></tr></thead>
              <tbody>
                {h.liabilities.map((l) => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.name}</td><td className="text-muted-foreground">{LIAB_LABEL[l.kind]}</td><td className="text-muted-foreground">{entity(l.entity)?.name}</td>
                    <td className="r">{usd(l.balance)}</td><td className="r">{pct(l.rate, 2)}</td><td className="r">{usd(l.payment)}</td>
                  </tr>
                ))}
                {!h.liabilities.length && <tr><td colSpan={6} className="text-muted-foreground">No liabilities.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Ratios" sub="How they are calculated is listed beside each">
          <KV rows={[
            ["Debt to assets", pct(v.ratios.debtToAssets)],
            ["Liquid assets to debt", v.debt ? `${v.ratios.liquidToDebt.toFixed(1)}×` : "No debt"],
            ["Months of spending in cash", v.ratios.liquidityMonths.toFixed(1)],
            ["Illiquid share of investable wealth", pct(v.ratios.illiquidShare)],
            ["Savings rate (of gross income)", pct(v.ratios.savingsRate)],
            ["Annual debt service", usd(annualDebtService)],
            ["Entities holding assets", String(new Set([...h.accounts.map((a) => a.entity), ...h.other.map((o) => o.entity)]).size)],
          ]} />
          <p className="mt-3 text-[12px] text-muted-foreground">Illiquid share excludes residences and compares private holdings with total assets less residences. Entity types: {[...new Set(h.entities.map((e) => ENTITY_LABEL[e.type]))].join(", ")}.</p>
        </Panel>
      </div>
    </div>
  );
}
