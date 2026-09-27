"use client";
import { BookOpen, Building2, Eraser, Gauge, Landmark, LineChart, ListChecks, Moon, Network, RotateCcw, Scale, Search, Star, Sun, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { money } from "@/lib/format";
import { value } from "@/lib/household";
import { actions, useBook } from "@/lib/store";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV: { group: string; items: [string, string, typeof Gauge][] }[] = [
  { group: "Advisor", items: [["/", "Dashboard", Gauge], ["/households", "Households", Users], ["/relationships", "Relationships", ListChecks]] },
  { group: "Markets", items: [["/markets", "Economic regime", LineChart], ["/committee", "Investment committee", Scale]] },
  { group: "Research", items: [["/research", "Fund analysis", Building2], ["/watchlist", "Watchlist", Star]] },
  { group: "Reference", items: [["/methodology", "Methodology", BookOpen], ["/architecture", "Architecture", Network]] },
];

function Sidebar() {
  const path = usePathname() || "/";
  const { households } = useBook();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border bg-subtle lg:flex">
      <Link href="/" className="flex items-center gap-3 px-5 pt-5 pb-6">
        <span className="grid size-8 place-items-center rounded-md bg-gold/15 ring-1 ring-gold/40">
          <Landmark className="size-4 text-gold" />
        </span>
        <span className="leading-tight">
          <span className="block text-[14px] font-semibold tracking-tight">Family Office OS</span>
          <span className="block text-[11px] text-muted-foreground">Private wealth platform</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="eyebrow px-2 pb-1.5">{g.group}</div>
            {g.items.map(([href, label, Icon]) => (
              <Link key={href} href={href}
                className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors", active(href) ? "bg-raised text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-raised/60 hover:text-foreground")}>
                <Icon className={cn("size-4", active(href) && "text-gold")} />
                {label}
              </Link>
            ))}
          </div>
        ))}
        <div>
          <div className="eyebrow px-2 pb-1.5">Clients</div>
          {households.map((h) => (
            <Link key={h.id} href={`/households/${h.id}`}
              className={cn("flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors", path.startsWith(`/households/${h.id}`) ? "bg-raised text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-raised/60 hover:text-foreground")}>
              <span className="truncate">{h.name}</span>
              <span className="num text-[11px] text-muted-foreground">{money(value(h, {}).netWorth, 0)}</span>
            </Link>
          ))}
        </div>
      </nav>
      <div className="border-t border-border px-5 py-4">
        <div className="text-[13px] font-medium">Noah Williams</div>
        <div className="text-[11.5px] text-muted-foreground">Private Wealth Advisor</div>
        <button onClick={() => confirm("Restore the four demo households and discard changes?") && actions.reset()}
          className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <RotateCcw className="size-3" /> Reset demo data
        </button>
        <button onClick={() => confirm("Remove every household and start with an empty book? You can restore the demo households later.") && actions.clear()}
          className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <Eraser className="size-3" /> Start empty book
        </button>
      </div>
    </aside>
  );
}

function ThemeButton() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-raised hover:text-foreground">
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function Topbar() {
  const router = useRouter();
  const { households } = useBook();
  const [q, setQ] = useState("");
  const hits = q.trim() ? households.filter((h) => `${h.name} ${h.people.map((p) => p.name).join(" ")}`.toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/85 px-6 backdrop-blur">
      <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden"><Landmark className="size-4 text-gold" /><span className="hidden text-[13px] font-semibold whitespace-nowrap sm:inline">Family Office OS</span></Link>
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search households and family members" aria-label="Search households"
          onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { router.push(`/households/${hits[0].id}`); setQ(""); } }}
          className="field h-8 pl-8" />
        {hits.length > 0 && (
          <ul className="absolute top-10 left-0 w-full overflow-hidden rounded-md border border-border bg-popover shadow-xl">
            {hits.map((h) => (
              <li key={h.id}>
                <button onMouseDown={() => { router.push(`/households/${h.id}`); setQ(""); }} className="flex w-full justify-between px-3 py-2 text-left text-[13px] hover:bg-raised">
                  <span>{h.name}</span><span className="text-muted-foreground">{h.tier}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-2 text-[12px] text-muted-foreground md:flex">
          <span className="size-1.5 rounded-full bg-pos" />
          Live data: FRED · Treasury · SEC · Yahoo Finance
        </span>
        <ThemeButton />
      </div>
    </header>
  );
}

function MobileNav() {
  const path = usePathname() || "/";
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 lg:hidden">
      {NAV.flatMap((g) => g.items).map(([href, label]) => (
        <Link key={href} href={href} className={cn("rounded-md px-2.5 py-1 text-[12.5px] whitespace-nowrap", (href === "/" ? path === "/" : path.startsWith(href)) ? "bg-raised text-foreground" : "text-muted-foreground")}>{label}</Link>
      ))}
    </nav>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <MobileNav />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-7 md:px-8">{children}</main>
      </div>
    </div>
  );
}
