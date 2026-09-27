"use client";
import { GraduationCap, Home, Landmark, Palmtree, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { actions } from "@/lib/store";
import { Pill, Ring } from "@/components/kit";
import { money, pct, thisYear } from "@/lib/format";
import type { HeatCell } from "@/lib/risk";
import type { Milestone } from "@/lib/timeline";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

const GOAL_ICON = { retirement: Palmtree, education: GraduationCap, home: Home, legacy: Landmark, purchase: ShoppingBag };
const PRIORITY = { 1: "Essential", 2: "Discretionary", 3: "Aspirational" };

export function GoalCard({ goal, probability, compare }: { goal: Goal; probability: number | undefined; compare?: number }) {
  const Icon = GOAL_ICON[goal.type];
  const p = probability ?? 1;
  return (
    <div className="panel flex items-center gap-4 px-4 py-3.5">
      <Ring value={p} size={58} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-gold" />
          <span className="truncate text-[13.5px] font-medium">{goal.name}</span>
        </div>
        <div className="mt-1 text-[12px] text-muted-foreground">
          {goal.type === "retirement" ? `From ${goal.year}, ${money(goal.amount)}/yr` : goal.type === "education" ? `${goal.year}–${goal.year + (goal.years ?? 4) - 1}, ${money(goal.amount)}/yr` : goal.type === "legacy" ? `${money(goal.amount)} to heirs` : `${goal.year}, ${money(goal.amount)}`}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Pill>{PRIORITY[goal.priority]}</Pill>
          {compare != null && Math.abs(compare - p) >= 0.005 && <span className={cn("num text-[11.5px]", p - compare >= 0 ? "text-pos" : "text-neg")}>{p - compare >= 0 ? "+" : ""}{pct(p - compare, 1)} vs base</span>}
        </div>
      </div>
    </div>
  );
}

const KIND_COLOR: Record<Milestone["kind"], string> = { family: "#a58bea", goal: "#d9a94a", retirement: "#3cbfae", tax: "#6f9cf6", debt: "#7e8aa3", estate: "#d6b676", event: "#e0708f" };

/** Horizontal timeline: one row of years with milestones stacked on each. */
export function Timeline({ items, limit = 14 }: { items: Milestone[]; limit?: number }) {
  const shown = items.slice(0, limit);
  const years = [...new Set(shown.map((m) => m.year))];
  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative flex min-w-max gap-0 pt-2">
        <div className="absolute top-[26px] right-0 left-0 h-px bg-border" />
        {years.map((y) => (
          <div key={y} className="relative w-[168px] shrink-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="relative z-10 size-3 rounded-full border-2 border-background bg-gold" />
              <span className="num text-[13px] font-semibold">{y}</span>
              <span className="text-[11px] text-muted-foreground">{y === thisYear() ? "this year" : `in ${y - thisYear()} yr`}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {shown.filter((m) => m.year === y).map((m, i) => (
                <li key={i} className="rounded-md border border-border bg-subtle px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-medium"><span className="size-1.5 rounded-full" style={{ background: KIND_COLOR[m.kind] }} />{m.title}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{m.detail}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const HEAT = ["var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)", "var(--heat-5)"];
export function HeatGrid({ cells, compact = false }: { cells: HeatCell[]; compact?: boolean }) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-5")}>
      {cells.map((c) => (
        <div key={c.name} className="rounded-lg p-3 ring-1 ring-inset ring-border/60" style={{ background: HEAT[Math.min(4, Math.round(c.score) - 1)] }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium">{c.name}</span>
            <Pill kind={c.level}>{c.level}</Pill>
          </div>
          {!compact && <p className="mt-2 text-[11.5px] leading-snug text-foreground/70">{c.driver}</p>}
        </div>
      ))}
    </div>
  );
}

/** Shown when the advisor has cleared the demo households and not yet added any. */
export function EmptyBook() {
  return (
    <div className="panel flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/30"><Users className="size-5 text-gold" /></span>
      <h2 className="mt-4 font-serif text-[28px]">Your book is empty</h2>
      <p className="mt-2 max-w-md text-[13.5px] text-muted-foreground">Create a household to start: enter the family, their accounts and goals, and the platform builds the investment policy, plan and risk profile. Households are saved in this browser.</p>
      <div className="mt-6 flex gap-2">
        <Button render={<Link href="/households" />}>Create a household</Button>
        <Button variant="outline" onClick={() => actions.reset()}>Restore demo households</Button>
      </div>
    </div>
  );
}
