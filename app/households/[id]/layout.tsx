"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use, useMemo } from "react";
import { Pill } from "@/components/kit";
import { useMacro, useModel, useQuotesAt } from "@/lib/data";
import { ageOn, money, prob } from "@/lib/format";
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
  const { quotes, at: quotesAt } = useQuotesAt(symbols);
  const { data: macro } = useMacro();
  const { v, plan, mc } = useModel(h, quotes);

  if (!h || !v || !plan || !mc)
    return <div className="py-20 text-center text-muted-foreground">Household not found. <Link href="/households" className="text-gold">Back to households</Link></div>;

  const base = `/households/${h.id}`;
  const current = path.slice(base.length).replace(/^\//, "").split("/")[0];
  const model = { h, v, plan, mc, quotes, quotesAt, macro, update: (fn: Parameters<typeof actions.update>[1]) => actions.update(h.id, fn) };

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
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
          <div><dt className="eyebrow">Net worth</dt><dd className="num mt-0.5 text-[15px] font-medium">{money(v.netWorth)}</dd></div>
          <div><dt className="eyebrow">Plan confidence</dt><dd className={cn("num mt-0.5 text-[15px] font-medium", mc.success < 0.75 ? "text-neg" : mc.success < 0.9 ? "text-warn" : "")}>{prob(mc.success)}</dd></div>
          <div><dt className="eyebrow">Profile</dt><dd className="mt-0.5"><Pill kind="gold">{h.ips.profile}</Pill></dd></div>
        </dl>
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
