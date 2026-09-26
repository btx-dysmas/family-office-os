// Meeting preparation: turns the household's current numbers into discussion points and follow-ups.
import { CLASS_LABEL } from "./cma";
import { date, money, nextBirthday, pct, sum, thisYear } from "./format";
import { clients, income, type Valuation } from "./household";
import type { Check } from "./ips";
import type { Result } from "./montecarlo";
import { LIMITS } from "./reference";
import type { Reading } from "./regime";
import type { Milestone } from "./timeline";
import type { Household } from "./types";

export type Point = { text: string; tone: "pos" | "neg" | "warn" | "info" };

export function brief(h: Household, v: Valuation, o: {
  mc: Result; checks: Check[]; rebalance: { required: boolean; turnover: number; breaches: { cls: string; current: number; target: number }[] };
  harvest: { symbol: string; gain: number; saving: number }[]; milestones: Milestone[]; regime?: Reading | null;
}) {
  const topics: Point[] = [];
  const prev = h.lastReview;
  const p = o.mc.success;
  if (prev) {
    const d = p - prev.probability;
    topics.push({ text: `Retirement readiness ${Math.abs(d) < 0.02 ? "is steady" : d > 0 ? "improved" : "declined"}: ${pct(p, 0)} probability of success, versus ${pct(prev.probability, 0)} at the ${date(prev.date)} review.`, tone: Math.abs(d) < 0.02 ? "info" : d > 0 ? "pos" : "neg" });
    const nw = v.netWorth - prev.netWorth;
    topics.push({ text: `Net worth is ${money(v.netWorth)}, ${nw >= 0 ? "up" : "down"} ${money(Math.abs(nw))} since the last review.`, tone: nw >= 0 ? "pos" : "neg" });
  } else topics.push({ text: `Retirement plan shows a ${pct(p, 0)} probability of success.`, tone: p >= 0.8 ? "pos" : "warn" });

  for (const g of h.goals.filter((g) => g.type !== "retirement")) {
    const prob = o.mc.probability[g.id];
    if (prob != null && prob < 0.75) topics.push({ text: `${g.name} is at risk: ${pct(prob, 0)} probability of being fully funded.`, tone: "neg" });
  }
  if (o.rebalance.required)
    topics.push({ text: `Portfolio drift detected: ${o.rebalance.breaches.map((b) => `${CLASS_LABEL[b.cls as keyof typeof CLASS_LABEL]} at ${pct(b.current, 0)} vs ${pct(b.target, 0)} target`).join("; ")}. Rebalancing would trade about ${money(o.rebalance.turnover)}.`, tone: "warn" });
  for (const c of o.checks.filter((c) => c.status === "Breach" && c.area !== "Allocation")) topics.push({ text: `IPS breach, ${c.area.toLowerCase()}: ${c.rule} (currently ${c.actual}).`, tone: "neg" });

  const cashMonths = v.ratios.liquidityMonths;
  if (cashMonths > h.ips.liquidityMonths * 1.75) topics.push({ text: `Cash has built up to ${cashMonths.toFixed(0)} months of spending, well above the ${h.ips.liquidityMonths}-month policy reserve. Consider investing the excess.`, tone: "warn" });
  const harvestable = sum(o.harvest.map((x) => -x.gain));
  if (harvestable > 5000) topics.push({ text: `Tax-loss harvesting opportunity: ${money(harvestable)} of losses in ${o.harvest.map((x) => x.symbol).join(", ")}, worth about ${money(sum(o.harvest.map((x) => x.saving)))} in tax savings.`, tone: "pos" });

  const workers = clients(h).filter((c) => (c.income ?? 0) > 0);
  if (workers.length) topics.push({ text: `Confirm ${thisYear()} contributions: up to ${money(LIMITS.k401)} per 401(k) and ${money(LIMITS.ira)} per IRA; household earned income is ${money(income(h))}.`, tone: "info" });

  const soon = o.milestones.filter((m) => m.year <= thisYear() + 2);
  for (const m of soon) topics.push({ text: `${m.year}: ${m.title}. ${m.detail}.`, tone: "info" });
  if (o.regime) topics.push({ text: `Economic backdrop: ${o.regime.regime.toLowerCase()} (${o.regime.reasons[0] ?? "see markets"}). Review what it means for the allocation.`, tone: "info" });

  const personal: Point[] = h.people
    .map((x) => ({ x, d: nextBirthday(x.dob) }))
    .filter(({ d }) => d <= 45)
    .map(({ x, d }) => ({ text: `${x.name}'s birthday ${d === 0 ? "is today" : `in ${d} days`}.`, tone: "info" as const }));
  const followUps = h.tasks.filter((t) => !t.done).map((t) => ({ text: `${t.title} (due ${date(t.due)})`, tone: t.priority === "High" ? ("warn" as const) : ("info" as const) }));
  const recent = h.notes.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);

  const agenda = [
    "Life updates and changes in goals",
    prev ? "Progress since the last review" : "Plan results",
    o.rebalance.required ? "Portfolio drift and proposed rebalancing" : "Portfolio performance and allocation",
    harvestable > 5000 ? "Year-end tax planning and loss harvesting" : "Tax planning",
    ...(soon.length ? ["Upcoming milestones"] : []),
    "Market environment",
    "Action items and next meeting",
  ];
  return { topics, personal, followUps, recent, agenda };
}
