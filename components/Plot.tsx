"use client";
import { useEffect, useRef } from "react";
import { lightFig, type Fig } from "@/lib/charts";
import { useTheme } from "@/lib/theme";

/* eslint-disable @typescript-eslint/no-explicit-any */
let plotly: Promise<any> | null = null;
const load = () => (plotly ??= import("plotly.js-dist-min").then((m) => m.default ?? m));

export default function Plot({ fig, height = 280, className = "" }: { fig: Fig; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const f = theme === "light" ? lightFig(fig, false) : fig;
    load().then((P) => live && P.react(el, f.data, { ...f.layout, height, autosize: true }, { displayModeBar: false, responsive: true }));
    return () => { live = false; };
  }, [fig, height, theme]);
  useEffect(() => {
    const el = ref.current;
    return () => { if (el) load().then((P) => P.purge(el)); };
  }, []);
  return <div ref={ref} className={className} style={{ height, width: "100%" }} />;
}

/** Render a figure to a PNG data URL for the PDF report (light theme). */
export async function figImage(fig: Fig, width = 900, height = 380): Promise<string> {
  const P = await load();
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px`;
  document.body.appendChild(el);
  try {
    const f = lightFig(fig);
    await P.newPlot(el, f.data, { ...f.layout, width, height }, { staticPlot: true });
    return await P.toImage(el, { format: "png", width, height, scale: 1.5 });
  } finally {
    P.purge(el);
    el.remove();
  }
}
