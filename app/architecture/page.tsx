import { PageHeader, Panel } from "@/components/kit";

export const metadata = { title: "Architecture · Family Office OS" };

type Box = { x: number; y: number; w: number; h: number; title: string; lines: string[]; tone?: "accent" | "source" };

function Node({ x, y, w, h, title, lines, tone }: Box) {
  const fill = tone === "accent" ? "var(--gold)" : tone === "source" ? "var(--raised)" : "var(--card)";
  const ink = tone === "accent" ? "var(--primary-foreground)" : "var(--foreground)";
  const sub = tone === "accent" ? "var(--primary-foreground)" : "var(--muted-foreground)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={tone === "accent" ? "var(--gold)" : "var(--input)"} />
      <text x={x + 14} y={y + 24} fontSize={14} fontWeight={600} fill={ink}>{title}</text>
      {lines.map((l, i) => <text key={l} x={x + 14} y={y + 44 + i * 17} fontSize={12} fill={sub} opacity={tone === "accent" ? 0.85 : 1}>{l}</text>)}
    </g>
  );
}

/** Straight arrow "M x1 y1 L x2 y2". A label sits at the midpoint, rotated to follow the line and lifted off it. */
function Arrow({ d, label }: { d: string; label?: string }) {
  const [x1, y1, x2, y2] = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const rad = (angle * Math.PI) / 180, lift = 7;
  const mx = (x1 + x2) / 2 + Math.sin(rad) * lift, my = (y1 + y2) / 2 - Math.cos(rad) * lift;
  return (
    <g>
      <path d={d} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#head)" />
      {label && <text x={mx} y={my} fontSize={11} fill="var(--muted-foreground)" textAnchor="middle" transform={`rotate(${angle.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})`}>{label}</text>}
    </g>
  );
}

function Diagram() {
  const sources: Box[] = [
    { x: 800, y: 20, w: 240, h: 74, title: "Yahoo Finance", lines: ["Prices, fund profiles, sectors,", "top holdings, returns"], tone: "source" },
    { x: 800, y: 106, w: 240, h: 74, title: "FRED", lines: ["Inflation, GDP, labor, rates,", "mortgage rates, spreads, VIX"], tone: "source" },
    { x: 800, y: 192, w: 240, h: 74, title: "U.S. Treasury", lines: ["Daily par yield curve (CSV)"], tone: "source" },
    { x: 800, y: 278, w: 240, h: 74, title: "SEC EDGAR · Form N-PORT", lines: ["Complete fund holdings,", "series-level filings"], tone: "source" },
  ];
  return (
    <svg viewBox="0 0 1060 540" className="h-auto w-full min-w-[760px]" role="img" aria-label="Family Office OS system architecture">
      <defs>
        <marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--muted-foreground)" />
        </marker>
      </defs>
      <rect x={10} y={10} width={330} height={520} rx={8} fill="none" stroke="var(--border)" strokeDasharray="4 4" />
      <text x={24} y={34} fontSize={11} letterSpacing=".1em" fill="var(--gold)" fontWeight={700}>BROWSER</text>
      <Node x={30} y={50} w={290} h={76} title="Household book" lines={["Families, entities, accounts, goals,", "IPS and CRM in localStorage"]} />
      <Node x={30} y={142} w={290} h={94} title="Household model" tone="accent" lines={["Live valuation and balance sheet", "→ cash-flow plan with life events", "→ 5,000-path Monte Carlo"]} />
      <Node x={30} y={252} w={290} h={94} title="Policy and risk engines" lines={["IPS compliance, rebalancing,", "asset location, loss harvesting,", "heat map, stress replay"]} />
      <Node x={30} y={362} w={290} h={76} title="Planning and markets" lines={["Tax, Social Security, estate, regime", "rules, investment committee"]} />
      <Node x={30} y={454} w={290} h={58} title="Reports (jsPDF)" lines={["Client review and meeting brief"]} />

      <rect x={390} y={10} width={360} height={520} rx={8} fill="none" stroke="var(--border)" strokeDasharray="4 4" />
      <text x={404} y={34} fontSize={11} letterSpacing=".1em" fill="var(--gold)" fontWeight={700}>VERCEL (FREE TIER)</text>
      <Node x={410} y={50} w={320} h={74} title="Edge CDN cache" lines={["Quotes 15 min, prices 3 h, macro 6 h,", "funds 12 h, N-PORT and stress 24 h"]} />
      <Node x={410} y={146} w={320} h={130} title="Route handlers (serverless)" lines={["/api/quotes  /api/prices  /api/fund", "/api/nport  /api/macro  /api/stress", "Fetch and cache public data only;", "no household data reaches the server", "Failed responses are never cached"]} />
      <Node x={410} y={298} w={320} h={74} title="SEC request throttle" lines={["≤10 requests a second with a declared", "User-Agent; large filings skipped"]} />
      <Node x={410} y={394} w={320} h={118} title="Reference data (compiled in)" lines={["IRS 2026 brackets, gains, NIIT, limits,", "estate and gift exclusions; SSA bend", "points; College Board tuition; capital", "market assumptions"]} />

      {sources.map((b) => <Node key={b.title} {...b} />)}
      <Node x={800} y={394} w={240} h={78} title="GitHub" lines={["Source of truth; every push", "to main redeploys on Vercel"]} />

      <Arrow d="M320 180 L406 90" label="fetch JSON" />
      <Arrow d="M570 124 L570 142" />
      <Arrow d="M730 190 L796 57" />
      <Arrow d="M730 202 L796 143" />
      <Arrow d="M730 214 L796 229" />
      <Arrow d="M730 226 L796 315" />
      <Arrow d="M570 276 L570 294" />
      <Arrow d="M800 432 L734 432" label="deploy" />
      <Arrow d="M406 452 L324 305" label="imported" />
    </svg>
  );
}

const STAGES: [string, string][] = [
  ["Data model and storage", "A household is one document: people, entities linked by ownership (trusts, LLCs, foundations, donor-advised funds, custodial and 529 accounts), accounts with tax treatment and statement dates, real and private assets, liabilities, prioritized goals, life events, a full investment policy statement, and relationship records such as notes, tasks, documents and beneficiary reviews. The book of households lives in the browser, so the platform runs on free hosting with nothing to provision, and client data never leaves the advisor's machine."],
  ["The household model", "Every household page shares one calculation. Holdings are valued at live prices; the balance sheet, ratios and estate inclusion follow from ownership. A year-by-year cash-flow plan combines savings, retirement spending net of Social Security (grossed up for tax), education, purchase and legacy goals, and any life events. A seeded Monte Carlo engine runs 5,000 paths in about 30 milliseconds, so the plan recalculates as the advisor types."],
  ["The IPS as executable policy", "The investment policy statement is data, not a document. Compliance checks every rule against the live portfolio; rebalancing trims concentrated positions first, then trades back to target inside each account using tax-advantaged accounts and low-gain lots first; asset location and loss harvesting price tax drag at the household's own marginal rates. Risk profiling, the investment committee, meeting briefs and client reports all read their rules from the same policy."],
  ["Ingestion and caching", "Route handlers fetch only public data: quotes and fund data from Yahoo Finance, economic series from FRED, the yield curve from the Treasury, complete fund holdings from SEC N-PORT filings, and long-history index funds for crisis replays. Responses are cached at the CDN with lifetimes matched to how often each source changes, deduplicated in memory on the server and cached per URL in the browser. A response without data is never cached, so a configuration fix takes effect immediately."],
];

export default function Architecture() {
  return (
    <>
      <PageHeader eyebrow="Reference" title="Architecture" sub="Next.js 16 on Vercel's free tier. No database, no paid APIs, no language model; household calculations run in the browser." />
      <Panel title="System overview" sub="Public data flows right to left; every household calculation happens on the left">
        <div className="overflow-x-auto"><Diagram /></div>
      </Panel>
      <h2 className="mt-8 mb-3 font-serif text-[22px] tracking-tight">How it works</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {STAGES.map(([t, body]) => (
          <Panel key={t} title={t}><p className="text-[13.5px] leading-relaxed text-muted-foreground">{body}</p></Panel>
        ))}
      </div>
      <Panel title="Design constraints" className="mt-4" pad={false}>
        <table className="grid-table">
          <thead><tr><th className="w-[190px]">Constraint</th><th>Decision</th></tr></thead>
          <tbody>
            {[
              ["Free to host", "Vercel Hobby and GitHub only. Serverless functions fetch in parallel, cache aggressively and skip filings too large to parse in time."],
              ["No database", "Households are stored in the browser. A production version would move the same data model behind authentication and an encrypted database."],
              ["Public data only", "Market and economic data from free public sources; IRS, SSA and College Board figures compiled in once a year and checked against the official publications."],
              ["Explainable", "Every figure comes from a stated source, assumption or formula; commentary comes from rules, not a language model. The methodology page lists every one."],
            ].map(([a, b]) => <tr key={a}><td className="font-medium">{a}</td><td className="text-muted-foreground">{b}</td></tr>)}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
