// Plotly figure builders. One theme for the dark UI; lightFig() recolors a figure for the white PDF page.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Fig = { data: any[]; layout: any };

export const C = {
  ink: "#e8ebf1", ink2: "#aab2c3", ink3: "#8b94a8", grid: "#1b2230", line: "#2a3242",
  c1: "#6f9cf6", c2: "#3cbfae", c3: "#d9a94a", c4: "#e0708f", c5: "#a58bea", c6: "#7e8aa3", gold: "#d6b676", pos: "#4cc38a", neg: "#ef6b6b",
};
export const SERIES = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6];
const A = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, "0");

type Opt = { y?: string; x?: string; legend?: boolean; margin?: any; hover?: string; ySuffix?: string; yPrefix?: string };
export function base(o: Opt = {}): any {
  const axis = { gridcolor: C.grid, linecolor: C.line, zerolinecolor: C.line, tickfont: { color: C.ink3, size: 11 }, title: { font: { color: C.ink3, size: 11 } }, fixedrange: true, automargin: true };
  return {
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "var(--font-geist-sans), Inter, system-ui, sans-serif", color: C.ink2, size: 12 },
    margin: o.margin ?? { l: 8, r: 12, t: 8, b: 8 },
    showlegend: o.legend !== false,
    legend: { orientation: "h", x: 0, y: -0.14, font: { color: C.ink2, size: 11 }, bgcolor: "rgba(0,0,0,0)" },
    hovermode: o.hover ?? "x unified",
    hoverlabel: { bgcolor: "#151b27", bordercolor: C.line, font: { color: C.ink, size: 12 } },
    xaxis: { ...axis, showgrid: false, title: { ...axis.title, text: o.x } },
    yaxis: { ...axis, title: { ...axis.title, text: o.y }, ticksuffix: o.ySuffix, tickprefix: o.yPrefix, zeroline: false },
  };
}

const line = (name: string, x: any[], y: any[], color: string, extra: any = {}) => ({ type: "scatter", mode: "lines", name, x, y, line: { color, width: 2 }, ...extra });

export function donut(labels: string[], values: number[], colors: string[], center?: string): Fig {
  const lay = base({ legend: false, hover: "closest" });
  if (center) lay.annotations = [{ text: center, showarrow: false, font: { color: C.ink, size: 15 }, x: 0.5, y: 0.5 }];
  return {
    data: [{ type: "pie", labels, values, hole: 0.72, sort: false, marker: { colors, line: { color: "#0e121a", width: 2 } }, textinfo: "none", hovertemplate: "%{label}<br>%{percent}<extra></extra>" }],
    layout: lay,
  };
}

export function hbars(labels: string[], values: number[], color: string | string[] = C.c1, fmt = ".0%"): Fig {
  const lay = base({ legend: false, hover: "closest" });
  lay.xaxis = { ...lay.xaxis, showgrid: true, gridcolor: C.grid, tickformat: fmt };
  lay.yaxis = { ...lay.yaxis, autorange: "reversed", tickfont: { color: C.ink2, size: 12 } };
  return { data: [{ type: "bar", orientation: "h", y: labels, x: values, marker: { color }, width: 0.62, hovertemplate: `%{x:${fmt}}<extra></extra>` }], layout: lay };
}

/** Current vs target allocation as paired horizontal bars. */
export function allocationBars(labels: string[], current: number[], target: number[]): Fig {
  const lay = base({ hover: "y unified" });
  lay.barmode = "group";
  lay.bargap = 0.35;
  lay.xaxis = { ...lay.xaxis, showgrid: true, gridcolor: C.grid, tickformat: ".0%" };
  lay.yaxis = { ...lay.yaxis, autorange: "reversed", tickfont: { color: C.ink2, size: 12 } };
  return {
    data: [
      { type: "bar", orientation: "h", name: "Current", y: labels, x: current, marker: { color: C.c1 }, hovertemplate: "%{x:.1%}" },
      { type: "bar", orientation: "h", name: "Target", y: labels, x: target, marker: { color: A(C.gold, 0.55) }, hovertemplate: "%{x:.1%}" },
    ],
    layout: lay,
  };
}

export function growth(dates: string[], series: { name: string; y: number[]; color: string; dash?: string }[], prefix = "$"): Fig {
  const lay = base({ yPrefix: prefix });
  lay.xaxis.type = "date";
  lay.yaxis.tickformat = "~s";
  return { data: series.map((s) => line(s.name, dates, s.y, s.color, { line: { color: s.color, width: s.dash ? 1.5 : 2, dash: s.dash }, hovertemplate: "%{y:$,.0f}" })), layout: lay };
}

export function pctLines(dates: string[], series: { name: string; y: number[]; color: string; dash?: string; fill?: boolean }[]): Fig {
  const lay = base({});
  lay.xaxis.type = "date";
  lay.yaxis.tickformat = ".0%";
  return {
    data: series.map((s) => line(s.name, dates, s.y, s.color, { line: { color: s.color, width: s.dash ? 1.4 : 1.8, dash: s.dash }, fill: s.fill ? "tozeroy" : undefined, fillcolor: s.fill ? A(s.color, 0.12) : undefined, hovertemplate: "%{y:.1%}" })),
    layout: lay,
  };
}

/** Monte Carlo fan: 5th–95th and 25th–75th percentile bands around the median. */
export function fan(years: number[], b: number[][], marker?: { x: number; label: string }): Fig {
  const lay = base({ yPrefix: "$" });
  lay.yaxis.tickformat = "~s";
  lay.yaxis.range = [0, Math.max(...b[3]) * 1.4];
  if (marker) {
    lay.shapes = [{ type: "line", x0: marker.x, x1: marker.x, yref: "paper", y0: 0, y1: 1, line: { color: C.ink3, width: 1, dash: "dot" } }];
    lay.annotations = [{ x: marker.x, yref: "paper", y: 1, text: marker.label, showarrow: false, xanchor: "left", xshift: 5, font: { color: C.ink3, size: 11 } }];
  }
  const t = "%{y:$,.0f}";
  return {
    data: [
      line("95th", years, b[4], A(C.c1, 0), { hovertemplate: t, showlegend: false }),
      line("5th–95th percentile", years, b[0], A(C.c1, 0), { fill: "tonexty", fillcolor: A(C.c1, 0.1), hovertemplate: t }),
      line("75th", years, b[3], A(C.c1, 0), { hovertemplate: t, showlegend: false }),
      line("25th–75th percentile", years, b[1], A(C.c1, 0), { fill: "tonexty", fillcolor: A(C.c1, 0.24), hovertemplate: t }),
      line("Median", years, b[2], C.c1, { line: { color: C.c1, width: 2.4 }, hovertemplate: t }),
    ],
    layout: lay,
  };
}

export function histogram(values: number[], color = C.c2, xTitle = "Ending wealth (today's dollars)"): Fig {
  const cap = values[Math.floor(values.length * 0.97)] || 1;
  const lay = base({ legend: false, x: xTitle, y: "Share of simulations", hover: "closest" });
  lay.xaxis = { ...lay.xaxis, tickprefix: "$", tickformat: "~s" };
  lay.yaxis.tickformat = ".0%";
  lay.bargap = 0.06;
  return { data: [{ type: "histogram", x: values.filter((v) => v <= cap), histnorm: "probability", nbinsx: 40, marker: { color }, hovertemplate: "%{y:.1%}<extra></extra>" }], layout: lay };
}

export function bars(labels: string[], values: number[], colors: string | string[], fmt = "$~s"): Fig {
  const lay = base({ legend: false, hover: "closest" });
  lay.yaxis.tickformat = fmt.replace("$", "");
  lay.yaxis.tickprefix = fmt.startsWith("$") ? "$" : "";
  return { data: [{ type: "bar", x: labels, y: values, marker: { color: colors }, width: 0.55, hovertemplate: `%{y:${fmt.startsWith("$") ? "$,.0f" : fmt}}<extra></extra>` }], layout: lay };
}

export function sankey(nodes: string[], colors: string[], links: { s: number; t: number; v: number; color?: string }[]): Fig {
  return {
    data: [{
      type: "sankey", arrangement: "snap",
      node: { label: nodes, color: colors, pad: 22, thickness: 16, line: { width: 0 }, hovertemplate: "%{label}<br>%{value:$,.0f}<extra></extra>" },
      link: { source: links.map((l) => l.s), target: links.map((l) => l.t), value: links.map((l) => l.v), color: links.map((l) => l.color ?? "rgba(111,156,246,0.22)"), hovertemplate: "%{value:$,.0f}<extra></extra>" },
    }],
    layout: { ...base({ legend: false, hover: "closest" }), font: { color: C.ink, size: 12 } },
  };
}

export function yieldCurve(curve: { tenors: string[]; latest: any; monthAgo: any; yearAgo: any }): Fig {
  const lay = base({ ySuffix: "%", hover: "x unified" });
  lay.xaxis = { ...lay.xaxis, type: "category" };
  const tr = (r: any, name: string, color: string, dash?: string) => r && line(`${name} (${r.date})`, curve.tenors.map((t: string) => t.replace(" Mo", "M").replace(" Yr", "Y")), r.yields, color, { mode: "lines+markers", marker: { size: 5, color }, line: { color, width: dash ? 1.5 : 2.4, dash }, hovertemplate: "%{y:.2f}%" });
  return { data: [tr(curve.latest, "Latest", C.c1), tr(curve.monthAgo, "1 month ago", C.c2, "dash"), tr(curve.yearAgo, "1 year ago", C.ink3, "dot")].filter(Boolean), layout: lay };
}

export function macroLines(series: Record<string, any>, ids: [string, string, string][], suffix = "%", from = "2012-01-01"): Fig {
  const lay = base({ ySuffix: suffix });
  lay.xaxis.type = "date";
  return {
    data: ids.filter(([id]) => series[id]?.obs).map(([id, name, color]) => {
      const o = series[id].obs.filter(([d]: [string]) => d >= from);
      return line(name, o.map((x: any) => x[0]), o.map((x: any) => x[1]), color, { hovertemplate: `%{y:.2f}${suffix}` });
    }),
    layout: lay,
  };
}

/** Same figure for print: white background, dark text, light gridlines. */
export function lightFig(f: Fig): Fig {
  const s = JSON.stringify(f).replaceAll(C.ink, "#1a2233").replaceAll(C.ink2, "#4b5568").replaceAll(C.ink3, "#737d91").replaceAll(C.grid, "#e6e9ef").replaceAll(C.line, "#cdd3de").replaceAll("#0e121a", "#ffffff").replaceAll("#151b27", "#ffffff");
  const out = JSON.parse(s);
  out.layout.paper_bgcolor = "#ffffff";
  out.layout.plot_bgcolor = "#ffffff";
  out.layout.font = { ...out.layout.font, family: "Helvetica, Arial, sans-serif" };
  return out;
}
