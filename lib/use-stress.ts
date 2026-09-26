"use client";
import { useMemo } from "react";
import type { Weights } from "./cma";
import { useApi } from "./data";
import { HISTORICAL, replay, type ScenarioData } from "./stress";

/** Historical stress replays for a set of weights, plus the worst loss (used by IPS compliance). */
export function useStress(w: Weights) {
  const { data, error } = useApi<ScenarioData[]>("/api/stress");
  const results = useMemo(
    () => (data ?? []).map((s) => {
      const meta = HISTORICAL.find((x) => x.id === s.id)!;
      return { ...meta, data: s, ...replay(w, s, meta.end) };
    }),
    [data, w],
  );
  const worst = results.length ? Math.min(...results.map((r) => r.worst)) : null;
  return { results, worst, loading: !data && !error, error };
}
