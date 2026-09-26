"use client";
// Client-ready PDFs (review report and meeting brief), built in the browser with jsPDF.
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { figImage } from "@/components/Plot";
import type { Analysis } from "./analytics";
import type { Fig } from "./charts";
import { CLASS_LABEL, CLASSES, portfolioStats } from "./cma";
import { date, money, pct, today } from "./format";
import { clients, drift, type Valuation } from "./household";
import type { Check } from "./ips";
import type { Result } from "./montecarlo";
import { IMPLICATIONS, type Reading } from "./regime";
import type { HeatCell } from "./risk";
import type { Household } from "./types";

const NAVY: [number, number, number] = [14, 18, 26], GOLD: [number, number, number] = [176, 142, 74], INK: [number, number, number] = [26, 34, 51], MUTED: [number, number, number] = [115, 125, 145];

function doc(h: Household, title: string) {
  const d = new jsPDF({ unit: "pt", format: "letter" });
  const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), M = 48;
  let y = 0;
  const header = () => {
    d.setFillColor(...NAVY).rect(0, 0, W, 70, "F");
    d.setTextColor(...GOLD).setFont("helvetica", "bold").setFontSize(9).text("FAMILY OFFICE OS", M, 28);
    d.setTextColor(255, 255, 255).setFont("times", "normal").setFontSize(20).text(`${h.name}`, M, 52);
    d.setFont("helvetica", "normal").setFontSize(9).setTextColor(200, 205, 215).text(`${title} · ${date(today())}`, W - M, 52, { align: "right" });
    y = 96;
  };
  const footer = () => {
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      d.setFontSize(7.5).setTextColor(...MUTED).setFont("helvetica", "normal");
      d.text(`Prepared by ${h.advisor}. Projections are hypothetical, based on stated assumptions, and are not guarantees. Not tax or legal advice.`, M, H - 24);
      d.text(`${i} / ${n}`, W - M, H - 24, { align: "right" });
    }
  };
  const need = (space: number) => { if (y + space > H - 60) { d.addPage(); header(); } };
  // `keep` reserves room for what follows so a heading never sits alone at the bottom of a page.
  const heading = (t: string, keep = 60) => {
    need(keep);
    d.setTextColor(...GOLD).setFont("helvetica", "bold").setFontSize(9).text(t.toUpperCase(), M, y);
    d.setDrawColor(...GOLD).setLineWidth(0.6).line(M, y + 5, W - M, y + 5);
    y += 20;
  };
  const para = (t: string, size = 9.5) => {
    d.setTextColor(...INK).setFont("helvetica", "normal").setFontSize(size);
    const lines = d.splitTextToSize(t, W - 2 * M);
    need(lines.length * size * 1.35 + 6);
    d.text(lines, M, y);
    y += lines.length * size * 1.35 + 6;
  };
  const table = (head: string[], body: (string | number)[][], opts: { widths?: number[] } = {}) => {
    need(40);
    autoTable(d, {
      startY: y, head: [head], body: body.map((r) => r.map(String)), margin: { left: M, right: M, top: 90, bottom: 50 }, theme: "plain",
      styles: { font: "helvetica", fontSize: 8.5, textColor: INK, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 } },
      headStyles: { textColor: MUTED, fontStyle: "bold", fontSize: 7.5, lineWidth: { bottom: 0.6 }, lineColor: [205, 211, 222] },
      bodyStyles: { lineWidth: { bottom: 0.3 }, lineColor: [230, 233, 239] },
      columnStyles: Object.fromEntries((opts.widths ?? []).map((w, i) => [i, { cellWidth: w }])),
      didDrawPage: () => header(),
    });
    y = (d as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  };
  const image = async (f: Fig, w = W - 2 * M, hgt = 200) => {
    need(hgt + 10);
    const png = await figImage(f, Math.round(w * 1.4), Math.round(hgt * 1.4));
    d.addImage(png, "PNG", M, y, w, hgt);
    y += hgt + 12;
  };
  header();
  return { d, W, M, heading, para, table, image, footer, save: (name: string) => { footer(); d.save(name); } };
}

export async function clientReport(h: Household, v: Valuation, o: { mc: Result; checks: Check[]; heat: HeatCell[]; stress: { name: string; worst: number }[]; analysis: Analysis | null; regime: Reading | null; figs: { allocation: Fig; fan: Fig } }) {
  const p = doc(h, "Client review");
  const s = portfolioStats(v.policyWeights);
  p.heading("Client summary");
  p.para(`${clients(h).map((c) => c.name).join(" and ")}. ${h.tier} household in ${h.state}, client since ${h.since.slice(0, 4)}. Risk profile: ${h.ips.profile}.`);
  p.table(["Measure", "Value"], [
    ["Net worth", money(v.netWorth)], ["Total assets", money(v.assets)], ["Liabilities", money(v.debt)], ["Invested assets (under policy)", money(v.policy)],
    ["Cash", `${money(v.cash)} (${v.ratios.liquidityMonths.toFixed(1)} months of spending)`], ["Debt to assets", pct(v.ratios.debtToAssets)],
  ], { widths: [220] });
  p.heading("Goals");
  p.table(["Goal", "Timing", "Amount (today's $)", "Probability funded"], h.goals.map((g) => [g.name, g.type === "education" ? `${g.year}–${g.year + (g.years ?? 4) - 1}` : String(g.year), g.type === "education" || g.type === "retirement" ? `${money(g.amount)}/yr` : money(g.amount), pct(g.type === "retirement" ? o.mc.success : o.mc.probability[g.id] ?? 1, 0)]));

  p.heading("Portfolio", 220);
  await p.image(o.figs.allocation, 516, 170);
  p.table(["Asset class", "Current", "Target", "Range", "Status"], drift(h, v.policyWeights).map((x) => [CLASS_LABEL[x.cls], pct(x.current), pct(x.target, 0), `${pct(x.min, 0)}–${pct(x.max, 0)}`, x.breach ? "Rebalance" : "In range"]));
  if (o.analysis) {
    const a = o.analysis;
    p.table(["Performance", "Portfolio", "S&P 500"], [["Total return", pct(a.port.total), pct(a.bench.total)], ["Annualized (CAGR)", pct(a.port.cagr), pct(a.bench.cagr)], ["Volatility", pct(a.port.vol), pct(a.bench.vol)], ["Maximum drawdown", pct(a.port.maxDD), pct(a.bench.maxDD)], ["Sharpe ratio", a.port.sharpe.toFixed(2), a.bench.sharpe.toFixed(2)]]);
    p.para(`Period: ${a.years.toFixed(1)} years of daily data, current holdings at today's weights.`, 8);
  }

  p.heading("Risk");
  p.para(`Expected return ${pct(s.mean - h.ips.advisoryFee)} after fees with ${pct(s.vol)} expected volatility (policy limit ${pct(h.ips.limits.maxVolatility, 0)}).`);
  p.table(["Risk", "Level", "Driver"], o.heat.map((c) => [c.name, c.level, c.driver]), { widths: [90, 60] });
  if (o.stress.length) p.table(["Historical stress", "Portfolio loss", "Dollar impact"], o.stress.map((x) => [x.name, pct(x.worst), money(x.worst * v.policy)]));

  p.heading("Planning", 240);
  await p.image(o.figs.fan, 516, 190);
  p.table(["Monte Carlo outcome", "Value"], [
    ["Simulations", o.mc.runs.toLocaleString("en-US")], ["Probability of success", pct(o.mc.success, 0)], ["Probability of depletion", pct(o.mc.depletion, 0)],
    ["Median ending wealth", money(o.mc.ending.median)], ["Worst case", money(o.mc.ending.worst)], ["5th percentile", money(o.mc.ending.p5)], ["Best case", money(o.mc.ending.best)],
  ], { widths: [220] });

  p.heading("Investment policy compliance");
  p.table(["Area", "Rule", "Current", "Status"], o.checks.map((c) => [c.area, c.rule, c.actual, c.status]), { widths: [70, 250] });

  if (o.regime) {
    const imp = IMPLICATIONS[o.regime.regime];
    p.heading("Economic environment");
    p.para(`Current regime: ${o.regime.regime}. ${imp.summary} Signals: ${o.regime.reasons.join("; ")}.`);
    p.table(["Asset class", "Typical positioning"], [["Equities", imp.equities], ["Bonds", imp.bonds], ["Real assets", imp.real], ["Cash", imp.cash]], { widths: [100] });
  }
  p.heading("Assumptions and disclosures");
  p.para(`Projections use long-run capital market assumptions (${CLASSES.map((c) => CLASS_LABEL[c]).join(", ")}), 2.5% inflation, 2026 federal tax rules and ${h.ips.advisoryFee * 100}% advisory fees. Prices from Yahoo Finance; economic data from FRED and the U.S. Treasury. Historical results do not guarantee future results.`, 8.5);
  p.save(`${h.id}-client-review-${today()}.pdf`);
}

export function meetingBrief(h: Household, b: { agenda: string[]; topics: { text: string }[]; personal: { text: string }[]; followUps: { text: string }[]; recent: { date: string; category: string; summary: string }[] }) {
  const p = doc(h, `Meeting brief${h.nextMeeting ? ` for ${date(h.nextMeeting)}` : ""}`);
  p.heading("Agenda");
  b.agenda.forEach((a, i) => p.para(`${i + 1}. ${a}`));
  p.heading("Discussion topics");
  b.topics.forEach((t) => p.para(`•  ${t.text}`));
  if (b.personal.length) { p.heading("Personal"); b.personal.forEach((t) => p.para(`•  ${t.text}`)); }
  p.heading("Open follow-ups");
  b.followUps.forEach((t) => p.para(`•  ${t.text}`));
  p.heading("Recent activity");
  p.table(["Date", "Type", "Summary"], b.recent.map((n) => [date(n.date), n.category, n.summary]), { widths: [70, 80] });
  p.save(`${h.id}-meeting-brief-${today()}.pdf`);
}
