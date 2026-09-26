// Household timeline: dated milestones derived from people, goals, liabilities and planned life events.
import { thisYear } from "./format";
import { clients } from "./household";
import { rmdAge } from "./reference";
import type { Household } from "./types";

export type Milestone = { year: number; title: string; detail: string; kind: "family" | "goal" | "retirement" | "tax" | "debt" | "estate" | "event" };

const EVENT_TITLE: Record<string, string> = {
  "job-loss": "Job loss (scenario)", "market-crash": "Market crash (scenario)", "inflation-spike": "Inflation spike (scenario)",
  "home-purchase": "Home purchase", "new-child": "New child", divorce: "Divorce (scenario)", inheritance: "Inheritance",
};

/** Months to pay off an amortizing loan: n = −ln(1 − rB/P) / ln(1 + r). */
const payoffYears = (balance: number, rate: number, payment: number) => {
  const r = rate / 12;
  if (payment <= balance * r) return null; // interest-only or negative amortization
  return Math.ceil(-Math.log(1 - (r * balance) / payment) / Math.log(1 + r) / 12);
};

export function timeline(h: Household): Milestone[] {
  const now = thisYear(), out: Milestone[] = [];
  for (const p of h.people) {
    const born = Number(p.dob.slice(0, 4));
    if ((p.relationship === "child" || p.relationship === "grandchild") && born + 18 >= now) out.push({ year: born + 18, title: `${p.name.split(" ")[0]} turns 18`, detail: "Custodial assets transfer; college begins", kind: "family" });
  }
  for (const p of clients(h)) {
    const born = Number(p.dob.slice(0, 4)), first = p.name.split(" ")[0];
    if (p.retireAge && born + p.retireAge >= now) out.push({ year: born + p.retireAge, title: `${first} retires`, detail: `At age ${p.retireAge}`, kind: "retirement" });
    if (born + 65 >= now) out.push({ year: born + 65, title: `${first} eligible for Medicare`, detail: "Age 65", kind: "retirement" });
    if (p.ssClaimAge && born + p.ssClaimAge >= now) out.push({ year: born + p.ssClaimAge, title: `${first} claims Social Security`, detail: `At age ${p.ssClaimAge}`, kind: "retirement" });
    const rmd = rmdAge(born);
    if (born + rmd >= now) out.push({ year: born + rmd, title: `${first}'s required distributions begin`, detail: `Age ${rmd} under SECURE 2.0`, kind: "tax" });
  }
  for (const g of h.goals) {
    if (g.type === "retirement") continue;
    out.push({ year: g.year, title: g.name, detail: g.type === "education" ? `${g.years ?? 4} years of college` : g.type === "legacy" ? "Planned legacy" : "Goal", kind: g.type === "legacy" ? "estate" : "goal" });
  }
  for (const l of h.liabilities) {
    const n = payoffYears(l.balance, l.rate, l.payment);
    if (n != null && n < 40) out.push({ year: now + n, title: `${l.name} paid off`, detail: `At the current payment of $${l.payment.toLocaleString("en-US")}/month`, kind: "debt" });
  }
  for (const e of h.events) out.push({ year: e.year, title: EVENT_TITLE[e.type] ?? e.type, detail: "Life event in the plan", kind: "event" });
  const deaths = clients(h).map((p) => Number(p.dob.slice(0, 4)) + (p.planToAge ?? 95));
  out.push({ year: Math.max(...deaths), title: "End of plan", detail: "Estate passes to heirs", kind: "estate" });
  return out.filter((m) => m.year >= now).sort((a, b) => a.year - b.year);
}
