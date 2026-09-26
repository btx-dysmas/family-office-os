"use client";
import { ArrowRight } from "lucide-react";
import { KV, Note, Panel, Pill, Stat } from "@/components/kit";
import Plot from "@/components/Plot";
import { allocationBars } from "@/lib/charts";
import { CLASS_LABEL, CLASSES } from "@/lib/cma";
import { money, pct, sum, usd } from "@/lib/format";
import { drift } from "@/lib/household";
import { useHH } from "@/lib/household-context";
import { assetLocation, harvest, rebalance } from "@/lib/ips";
import { LIMITS } from "@/lib/reference";
import { householdRates, incomeTax } from "@/lib/tax";

const BUCKETS = [["taxable", "Taxable"], ["tax-deferred", "Tax-deferred"], ["tax-free", "Roth (tax-free)"]] as const;

export default function Rebalancing() {
  const { h, v } = useHH();
  const d = drift(h, v.policyWeights);
  const r = rebalance(h, v);
  const loc = assetLocation(h, v);
  const tlh = harvest(h, v);
  const rates = householdRates(h);
  const wages = incomeTax(rates.wages, h.filing);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sleeves outside band" value={String(r.breaches.length)} tone={r.breaches.length ? "neg" : "pos"} sub={r.breaches.length ? r.breaches.map((b) => CLASS_LABEL[b.cls]).join(", ") : "Every sleeve within its IPS range"} />
        <Stat label="Trades to target" value={money(r.turnover)} sub={`${pct(r.turnover / (v.policy || 1))} of the portfolio`} />
        <Stat label="Estimated tax cost" value={money(r.tax)} sub={`${money(r.realized)} of realized gains at ${pct(rates.gains)}`} tone={r.tax > 0 ? "warn" : undefined} />
        <Stat label="Asset location savings" value={`${money(loc.saving)}/yr`} sub="Estimated annual tax drag avoided" tone={loc.saving > 0 ? "pos" : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Drift against policy" sub="Current weights against IPS targets and ranges">
          <Plot fig={allocationBars(d.map((x) => CLASS_LABEL[x.cls]), d.map((x) => x.current), d.map((x) => x.target))} height={270} />
          <table className="grid-table mt-2">
            <thead><tr><th>Sleeve</th><th className="r">Range</th><th className="r">Current</th><th className="r">Drift</th><th /></tr></thead>
            <tbody>
              {d.map((x) => (
                <tr key={x.cls}>
                  <td>{CLASS_LABEL[x.cls]}</td><td className="r text-muted-foreground">{pct(x.min, 0)}–{pct(x.max, 0)}</td><td className="r">{pct(x.current)}</td>
                  <td className={`r ${x.breach ? "text-neg" : "text-muted-foreground"}`}>{pct(x.diff, 1, true)}</td>
                  <td className="text-right">{x.breach ? <Pill kind="Breach">Rebalance</Pill> : <Pill kind="Compliant">In range</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Proposed trades" sub={r.required ? "Required: at least one sleeve is outside its range" : "Optional: every sleeve is within range; these trades return exactly to target"} pad={false}>
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead><tr><th>Account</th><th>Action</th><th>Security</th><th>Sleeve</th><th className="r">Amount</th><th className="r">Realized gain</th></tr></thead>
              <tbody>
                {r.trades.map((t, i) => (
                  <tr key={i}>
                    <td><div className="font-medium">{t.accountName}</div><div className="text-[11px] text-muted-foreground">{t.tax.replace("-", " ")}</div></td>
                    <td><Pill kind={t.action === "Sell" ? "Breach" : "Compliant"}>{t.action}</Pill></td>
                    <td className="font-medium">{t.symbol === "$CASH" ? "Cash" : t.symbol}</td>
                    <td className="text-muted-foreground">{CLASS_LABEL[t.cls]}</td>
                    <td className="r">{usd(t.amount)}</td>
                    <td className={`r ${t.gain > 0 ? "text-warn" : t.gain < 0 ? "text-pos" : "text-muted-foreground"}`}>{t.tax === "taxable" && t.action === "Sell" ? money(t.gain) : "—"}</td>
                  </tr>
                ))}
                {!r.trades.length && <tr><td colSpan={6} className="text-muted-foreground">Already at target.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4"><Note>First, any single security above the IPS position limit is trimmed back to it (in practice these sales are often staged across tax years). Then sleeves are rebalanced: sells come from tax-deferred and Roth accounts first, then from taxable lots with the lowest gain (losses first). Buys follow the asset-location preference: bonds and REITs in tax-deferred accounts, growth in Roth accounts. Cash stays in the account where it was raised, so no money moves between accounts, and bank accounts are left alone. Gaps under 0.5% of the portfolio are not traded.</Note></div>
        </Panel>
      </div>

      <Panel title="Asset location" sub="Which account type should hold each sleeve, and the tax drag of getting it wrong">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead><tr><th>Sleeve</th>{BUCKETS.map(([k, l]) => <th key={k} className="r">{l}</th>)}<th className="r">Tax drag if taxable</th></tr></thead>
              <tbody>
                {CLASSES.filter((c) => sum(Object.values(loc.plan[c])) + sum(Object.values(loc.current[c])) > 0).map((c) => (
                  <tr key={c}>
                    <td>{CLASS_LABEL[c]}</td>
                    {BUCKETS.map(([k]) => (
                      <td key={k} className="r">
                        <span className="text-muted-foreground">{money(loc.current[c][k])}</span>
                        {Math.abs(loc.current[c][k] - loc.plan[c][k]) > 1000 && <><ArrowRight className="mx-1 inline size-3 text-gold" /><span className="font-semibold">{money(loc.plan[c][k])}</span></>}
                      </td>
                    ))}
                    <td className="r">{pct(loc.drag[c], 2)}/yr</td>
                  </tr>
                ))}
                <tr><td className="font-medium">Account capacity</td>{BUCKETS.map(([k]) => <td key={k} className="r font-medium">{money(loc.capacity[k])}</td>)}<td /></tr>
              </tbody>
            </table>
          </div>
          <div>
            <KV rows={[
              ["Tax drag, current placement", `${usd(loc.currentDrag)}/yr`],
              ["Tax drag, optimized placement", `${usd(loc.optimalDrag)}/yr`],
              ["Estimated annual savings", <span key="s" className="text-pos">{usd(loc.saving)}/yr</span>],
              ["Marginal rate on ordinary income", pct(rates.ordinary)],
              ["Rate on qualified dividends and gains", pct(rates.gains)],
            ]} />
            <Note>Least tax-efficient sleeves (taxable bond interest, REIT dividends) fill tax-deferred accounts first; the highest expected growth fills Roth accounts, where it is never taxed; broad equity index funds, which mostly pay qualified dividends, sit in taxable accounts. Rates include the 3.8% net investment income tax where it applies. Location is changed gradually, when trades are already needed.</Note>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Tax-loss harvesting" sub="Taxable positions trading below cost" pad={false}>
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead><tr><th>Account</th><th>Security</th><th className="r">Value</th><th className="r">Loss</th><th>Swap into</th><th className="r">Tax saved</th></tr></thead>
              <tbody>
                {tlh.map((x, i) => (
                  <tr key={i}>
                    <td className="text-muted-foreground">{x.account.name}</td><td className="font-medium">{x.symbol}</td><td className="r">{usd(x.value)}</td>
                    <td className="r text-neg">{money(x.gain)}</td><td>{x.replacement}</td><td className="r text-pos">{money(x.saving)}</td>
                  </tr>
                ))}
                {!tlh.length && <tr><td colSpan={6} className="text-muted-foreground">No positions with losses worth harvesting.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4"><Note>Savings assume the loss offsets long-term gains at {pct(rates.gains)}. The replacement fund tracks a different index, so the swap keeps market exposure without triggering the 30-day wash-sale rule.</Note></div>
        </Panel>
        <Panel title="Tax snapshot" sub="2026 federal rules">
          <KV rows={[
            ["Filing status", h.filing === "mfj" ? "Married filing jointly" : h.filing === "hoh" ? "Head of household" : "Single"],
            ["Earned income", usd(rates.wages)],
            ["Federal income tax (estimated)", usd(wages.tax)],
            ["Effective / marginal rate", `${pct(wages.effective)} / ${pct(wages.marginal, 0)}`],
            ["401(k) limit per person", `${usd(LIMITS.k401)} (+${usd(LIMITS.k401CatchUp)} at 50+)`],
            ["IRA limit per person", `${usd(LIMITS.ira)} (+${usd(LIMITS.iraCatchUp)} at 50+)`],
          ]} />
          <Note>Federal only, using the standard deduction. State taxes and itemized deductions are not modeled.</Note>
        </Panel>
      </div>
    </div>
  );
}
