"use client";
// Client-side book of business. Households live in the browser (localStorage) so the app needs no database;
// "Reset demo data" restores the seeded households; "Start empty book" removes them.
import { useSyncExternalStore } from "react";
import { SEED } from "./seed";
import type { Household } from "./types";

const KEY = "fos:book:v4"; // bumped when the demo data model gains fields
const WATCH_KEY = "fos:watch:v1";
export const DEFAULT_WATCH = ["VOO", "VTI", "SCHD", "QQQ", "BND", "VXUS", "TLT", "GLD", "NVDA", "AAPL", "MSFT", "JPM"];

type State = { households: Household[]; watch: string[] };
let state: State = { households: SEED, watch: DEFAULT_WATCH };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const h = localStorage.getItem(KEY), w = localStorage.getItem(WATCH_KEY);
    state = { households: h ? JSON.parse(h) : SEED, watch: w ? JSON.parse(w) : DEFAULT_WATCH };
  } catch {
    /* private mode or corrupted storage: fall back to the seed */
  }
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(state.households));
    localStorage.setItem(WATCH_KEY, JSON.stringify(state.watch));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
};
// Server render and the first client render both use the seed, so markup matches before storage is read.
const serverState: State = { households: SEED, watch: DEFAULT_WATCH };

export function useBook() {
  return useSyncExternalStore(subscribe, () => (load(), state), () => serverState);
}

export function useHousehold(id: string) {
  const { households } = useBook();
  return households.find((h) => h.id === id) ?? null;
}

export const actions = {
  save(h: Household) {
    const exists = state.households.some((x) => x.id === h.id);
    set({ households: exists ? state.households.map((x) => (x.id === h.id ? h : x)) : [...state.households, h] });
  },
  update(id: string, fn: (h: Household) => Household) {
    set({ households: state.households.map((x) => (x.id === id ? fn(x) : x)) });
  },
  remove(id: string) {
    set({ households: state.households.filter((x) => x.id !== id) });
  },
  setWatch(watch: string[]) {
    set({ watch });
  },
  clear() {
    set({ households: [] });
  },
  reset() {
    set({ households: SEED, watch: DEFAULT_WATCH });
  },
};
