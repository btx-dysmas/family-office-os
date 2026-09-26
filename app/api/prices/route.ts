import { respond } from "@/lib/server/cache";
import { history } from "@/lib/server/yahoo";

export const maxDuration = 60;
const BENCH = "SPY";

// Adjusted daily closes for up to 40 symbols on the S&P 500 trading calendar.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const range = ["1y", "3y", "5y", "10y"].includes(params.get("range") ?? "") ? params.get("range")! : "5y";
  const symbols = [...new Set((params.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => s && !s.startsWith("$")))].slice(0, 40);
  return respond(async () => {
    const [bench, ...rest] = await Promise.all([BENCH, ...symbols].map((s) => history(s, range).catch(() => null)));
    if (!bench) throw new Error("Benchmark prices unavailable");
    const round = (v: number | null | undefined) => (v == null ? null : Math.round(v * 1000) / 1000);
    const series: Record<string, (number | null)[]> = {};
    symbols.forEach((s, i) => {
      const h = rest[i];
      if (!h) return;
      const idx = new Map(h.dates.map((d, k) => [d, k]));
      series[s] = bench.dates.map((d) => (idx.has(d) ? round(h.adj[idx.get(d)!]) : null));
    });
    return { dates: bench.dates, bench: bench.adj.map(round), series };
  }, 3 * 3600);
}
