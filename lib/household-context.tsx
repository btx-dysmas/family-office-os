"use client";
import { createContext, useContext } from "react";
import type { Quotes, Valuation } from "./household";
import type { Plan, Result } from "./montecarlo";
import type { Macro } from "./server/macro";
import type { Household } from "./types";

export type HouseholdModel = { h: Household; v: Valuation; plan: Plan; mc: Result; quotes: Quotes; quotesAt: number | null; macro: Macro | null; update: (fn: (h: Household) => Household) => void };

export const HouseholdContext = createContext<HouseholdModel | null>(null);

export function useHH() {
  const m = useContext(HouseholdContext);
  if (!m) throw new Error("useHH must be used inside a household page");
  return m;
}
