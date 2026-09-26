"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use, useMemo } from "react";
import { Pill, Ring } from "@/components/kit";
import { useMacro, useModel, useQuotes } from "@/lib/data";
import { ageOn, money, pct } from "@/lib/format";
import { clients } from "@/lib/household";
import { HouseholdContext } from "@/lib/household-context";
import { actions, useHousehold } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS: [string, string][] = [
  ["", "Overview"], ["balance-sheet", "Balance sheet"], ["structure", "Entities"], ["policy", "Investment policy"], ["portfolio", "Portfolio"],
  ["rebalancing", "Rebalancing & tax"], ["planning", "Goals & planning"], ["estate", "Wealth transfer"], ["risk", "Risk"],
  ["relationship", "Relationship"], ["meeting", "Meeting prep"], ["report", "Report"],
];

export default function HouseholdLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const h = useHousehold(id);
  const path = usePathname() || "";
  const symbols = useMemo(() => h?.accounts.flatMap((a) => a.holdings.map((x) => x.symbol)) ?? [], [h]);
  const quotes = useQuotes(symbols);
  const { data: macro } = useMacro();
  const { v, plan, mc } = useModel(h, quotes);

  if (!h || !v || !plan || !mc)
    return <div className="py-20 text-center text-muted-foreground">Household not found. <Link href="/households" className="text-gold">Back to households</Link></div>;

  const base = `/households/${h.id}`;
  const current = path.slice(base.length).replace(/^\//, "").split("/")[0];
  const model = { h, v, plan, mc, quotes, macro, update: (fn: Parameters<typeof actions.update>[1]) => actions.update(h.id, fn) };

  return (
    <HouseholdContext.Provider value={model}>
      <div className="flex flex-wrap items-end justify-between gap-6 pb-5">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-2"><Link href="/households" className="hover:text-foreground">Households</Link><span>/</span><span>{h.tier}</span></div>
          <h1 className="font-serif text-[38px] leading-none tracking-tight">{h.name}</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {clients(h).map((p) => `${p.name.split(",")[0]} (${ageOn(p.dob)})`).join(" · ")} · {h.state} · Client since {h.since.slice(0, 4)} · Advisor {h.advisor}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right"><div className="eyebrow">Net worth</div><div className="num mt-1 text-[22px] font-semibold">{money(v.netWorth)}</div></div>
          <div className="text-right"><div className="eyebrow">Invested</div><div className="num mt-1 text-[22px] font-semibold">{money(v.policy)}</div></div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <Ring value={mc.success} size={46} />
            <div><div className="eyebrow">Retirement</div><div className="text-[12px] text-muted-foreground">{pct(mc.success, 0)} success</div></div>
          </div>
          <Pill kind="gold">{h.ips.profile}</Pill>
        </div>
      </div>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(([slug, label]) => (
          <Link key={slug} href={slug ? `${base}/${slug}` : base}
            className={cn("-mb-px border-b-2 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors", current === slug ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </HouseholdContext.Provider>
  );
}
