// Complete fund holdings from the latest SEC Form N-PORT filing: ticker → series id → filing → primary_doc.xml.
import { HOUR, memo } from "./cache";

const UA = process.env.SEC_USER_AGENT?.trim() || "Family Office OS research@example.com";

let queue: Promise<void> = Promise.resolve();
async function sec(url: string) {
  // SEC fair-access policy: at most 10 requests a second, with a declared User-Agent.
  const turn = queue.then(() => new Promise<void>((r) => setTimeout(r, 120)));
  queue = turn;
  await turn;
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip, deflate" }, cache: "no-store" });
  if (!r.ok) throw new Error(`SEC ${r.status}: ${url}`);
  return r;
}

function fundIndex() {
  return memo("sec:mf", 24 * HOUR, async () => {
    const j = (await (await sec("https://www.sec.gov/files/company_tickers_mf.json")).json()) as { data: [number, string, string, string][] };
    return new Map(j.data.map(([cik, series, , symbol]) => [symbol.toUpperCase(), { cik, series }]));
  });
}

const decode = (x: string) => x.replace(/&amp;/g, "&").replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const tag = (xml: string, name: string) => { const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]; return m == null ? null : decode(m); };

const ASSET_CAT: Record<string, string> = {
  EC: "Equity", EP: "Preferred equity", DBT: "Debt", ABS: "Asset-backed", "ABS-MBS": "Mortgage-backed", "ABS-CBDO": "Collateralized debt",
  "ABS-O": "Asset-backed", STIV: "Short-term vehicle", RE: "Real estate", COMM: "Commodity", DE: "Derivative", LON: "Loan", OTHER: "Other",
};
const ISSUER_CAT: Record<string, string> = { CORP: "Corporate", UST: "U.S. Treasury", USGA: "U.S. agency", USGSE: "U.S. GSE", MUN: "Municipal", NUSS: "Foreign sovereign", RF: "Registered fund", PF: "Private fund", OTHER: "Other" };

export function nport(symbol: string) {
  return memo(`nport:${symbol}`, 24 * HOUR, async () => {
    const hit = (await fundIndex()).get(symbol.toUpperCase());
    if (!hit) return null;
    const atom = await (await sec(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${hit.series}&type=NPORT-P&dateb=&owner=include&count=1&output=atom`)).text();
    const index = /<filing-href>(.*?)<\/filing-href>/.exec(atom)?.[1];
    if (!index) return null;
    const page = await (await sec(index)).text();
    const doc = [...page.matchAll(/href="(\/Archives\/[^"]+\/primary_doc\.xml)"/g)].map((m) => m[1]).find((p) => !p.includes("xsl"));
    if (!doc) return null;
    const res = await sec("https://www.sec.gov" + doc);
    // Very large bond funds (tens of thousands of positions) would exceed a serverless function's budget.
    if (Number(res.headers.get("content-length") ?? 0) > 4_000_000) return { symbol, series: hit.series, filing: index, tooLarge: true as const };
    const xml = await res.text();
    const positions: { name: string; cusip: string | null; value: number; weight: number; asset: string; issuer: string; country: string }[] = [];
    for (const m of xml.matchAll(/<invstOrSec>([\s\S]*?)<\/invstOrSec>/g)) {
      const x = m[1];
      positions.push({
        name: tag(x, "name") ?? tag(x, "title") ?? "",
        cusip: tag(x, "cusip"),
        value: Number(tag(x, "valUSD") ?? 0),
        weight: Number(tag(x, "pctVal") ?? 0) / 100,
        asset: ASSET_CAT[tag(x, "assetCat") ?? ""] ?? tag(x, "assetCat") ?? "Other",
        issuer: ISSUER_CAT[tag(x, "issuerCat") ?? ""] ?? "Other",
        country: tag(x, "invCountry") ?? "—",
      });
    }
    positions.sort((a, b) => b.value - a.value);
    const group = (key: "asset" | "issuer" | "country") => {
      const g = new Map<string, number>();
      positions.forEach((p) => g.set(p[key], (g.get(p[key]) ?? 0) + p.weight));
      return [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    };
    return {
      symbol, series: hit.series, filing: index, tooLarge: false as const,
      period: tag(xml, "repPdDate"), netAssets: Number(tag(xml, "netAssets") ?? 0), count: positions.length,
      top: positions.slice(0, 25), top10: positions.slice(0, 10).reduce((s, p) => s + p.weight, 0),
      byAsset: group("asset"), byIssuer: group("issuer"), byCountry: group("country"),
    };
  });
}
