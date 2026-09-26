// Small presentational building blocks shared by every page.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ title, sub, action, children, className, pad = true }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn("panel flex min-w-0 flex-col", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h3 className="text-[14px] font-medium text-foreground">{title}</h3>}
            {sub && <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn("min-w-0 flex-1", pad && "px-5 pb-5", pad && !title && !action && "pt-5")}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "pos" | "neg" | "warn"; className?: string }) {
  return (
    <div className={cn("panel px-5 py-4", className)}>
      <div className="eyebrow">{label}</div>
      <div className={cn("num mt-2 text-[26px] leading-none font-semibold tracking-tight", tone === "pos" && "text-pos", tone === "neg" && "text-neg", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="mt-2 text-[12px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

const PILL = {
  Compliant: "bg-pos/12 text-pos ring-pos/25", Watch: "bg-warn/12 text-warn ring-warn/25", Breach: "bg-neg/12 text-neg ring-neg/25",
  Low: "bg-pos/12 text-pos ring-pos/25", Moderate: "bg-c1/12 text-c1 ring-c1/25", Elevated: "bg-warn/12 text-warn ring-warn/25", High: "bg-neg/12 text-neg ring-neg/25",
  neutral: "bg-muted text-muted-foreground ring-border", gold: "bg-gold/12 text-gold ring-gold/30",
} as const;
export function Pill({ kind = "neutral", children }: { kind?: keyof typeof PILL; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", PILL[kind])}>{children}</span>;
}

export function Meter({ value, color = "var(--c1)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

/** Probability shown as a ring gauge. */
export function Ring({ value, size = 64, color }: { value: number; size?: number; color?: string }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  const col = color ?? (v >= 0.8 ? "var(--pos)" : v >= 0.6 ? "var(--warn)" : "var(--neg)");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(v * 100)}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--foreground)" fontSize={size * 0.24} fontWeight={600} className="num">{Math.round(v * 100)}%</text>
    </svg>
  );
}

export function KV({ rows, className }: { rows: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border/70 text-[13px]", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-6 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="num text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-subtle p-0.5">
      {options.map(([v, l]) => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={cn("rounded px-2.5 py-1 text-[12px] transition-colors", v === value ? "bg-raised text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-serif text-[34px] leading-none tracking-tight text-foreground">{title}</h1>
        {sub && <p className="mt-2 max-w-3xl text-[13.5px] text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{children}</p>;

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-[13px] text-muted-foreground">
      <span className="size-4 animate-spin rounded-full border-2 border-border border-t-gold" />
      {label}
    </div>
  );
}

export const Dot = ({ color }: { color: string }) => <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />;
