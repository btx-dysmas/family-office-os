// What needs the advisor's attention for one household, most urgent first. Each item links to where it's handled.
import { daysUntil, money, thisYear, today } from "./format";
import { clients, type Valuation } from "./household";
import type { Check } from "./ips";
import type { Plan } from "./montecarlo";
import { rmdAge } from "./reference";
import type { Household } from "./types";

export type Severity = "high" | "medium" | "low";
export type Item = { severity: Severity; title: string; detail: string; tab: string };

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function attention(h: Household, v: Valuation, o: { checks: Check[]; plan: Plan; estateTax?: number; harvestable?: number; harvestSaving?: number }): Item[] {
  const out: Item[] = [];

  for (const c of o.checks.filter((c) => c.status === "Breach"))
    out.push({ severity: c.area === "Allocation" ? "medium" : "high", title: `IPS breach: ${c.rule.split(" (")[0]}`, detail: `Currently ${c.actual}`, tab: c.area === "Allocation" || c.area === "Concentration" ? "rebalancing" : "policy" });

  const reviewDue = daysUntil(`${Number(h.ips.lastReview.slice(0, 4)) + 1}${h.ips.lastReview.slice(4)}`);
  if (reviewDue <= 60) out.push({ severity: reviewDue < 0 ? "high" : "medium", title: reviewDue < 0 ? `IPS review overdue by ${-reviewDue} days` : `IPS review due in ${reviewDue} days`, detail: `Last reviewed ${h.ips.lastReview}`, tab: "policy" });

  for (const d of h.documents ?? []) {
    if (d.status === "Awaiting signature") out.push({ severity: "medium", title: `Awaiting signature: ${d.name}`, detail: `Sent ${-daysUntil(d.date)} days ago`, tab: "relationship" });
    if (d.status === "Review due") out.push({ severity: "low", title: `Document review due: ${d.name}`, detail: `Last updated ${d.date.slice(0, 4)}`, tab: "relationship" });
  }
  if (h.beneficiaryReview && -daysUntil(h.beneficiaryReview) > 3 * 365)
    out.push({ severity: "medium", title: "Beneficiary designations not reviewed in over 3 years", detail: `Last confirmed ${h.beneficiaryReview}`, tab: "estate" });

  if (o.estateTax && o.estateTax > 0) out.push({ severity: "medium", title: `Projected federal estate tax of ${money(o.estateTax)}`, detail: "Before any gifting or trust strategy", tab: "estate" });

  // Liquidity events in the next 24 months, other than regular savings and retirement spending.
  const soon = o.plan.flows.filter((f) => f.amount < 0 && f.label !== "Retirement spending" && f.year <= thisYear() + 2);
  for (const f of soon.filter((f, i) => soon.findIndex((x) => x.label === f.label) === i))
    out.push({ severity: "low", title: `Liquidity event: ${f.label}`, detail: `${money(-f.amount)} scheduled for ${f.year}`, tab: "planning" });

  for (const p of clients(h)) {
    const born = Number(p.dob.slice(0, 4)), start = born + rmdAge(born);
    if (start - thisYear() <= 3 && start >= thisYear()) out.push({ severity: "low", title: `Required distributions begin for ${p.name.split(" ")[0]} in ${start}`, detail: `Age ${rmdAge(born)}; plan withdrawals and Roth conversions before then`, tab: "planning" });
  }

  if (o.harvestable && o.harvestable > 5000) out.push({ severity: "low", title: `${money(o.harvestable)} of harvestable losses`, detail: `About ${money(o.harvestSaving ?? 0)} in tax savings`, tab: "rebalancing" });
  if (v.ratios.liquidityMonths > h.ips.liquidityMonths * 1.75) out.push({ severity: "low", title: `Excess cash: ${v.ratios.liquidityMonths.toFixed(1)} months of spending`, detail: `Policy reserve is ${h.ips.liquidityMonths} months`, tab: "rebalancing" });

  const stale = h.accounts.filter((a) => a.asOf && -daysUntil(a.asOf) > 45);
  if (stale.length) out.push({ severity: "low", title: `${stale.length} account${stale.length > 1 ? "s" : ""} with statements older than 45 days`, detail: stale.map((a) => a.name).join(", "), tab: "balance-sheet" });

  for (const t of h.tasks.filter((t) => !t.done && t.due < today())) out.push({ severity: "medium", title: `Overdue: ${t.title}`, detail: `Was due ${t.due}`, tab: "relationship" });

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

