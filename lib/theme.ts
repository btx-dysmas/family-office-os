"use client";
// Dark by default; the choice is saved and applied in <head> before first paint (see theme-script.ts).
import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export type Theme = "dark" | "light";

const listeners = new Set<() => void>();
const read = (): Theme => (document.documentElement.classList.contains("light") ? "light" : "dark");

export function useTheme() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), read, () => "dark" as Theme);
}

export function setTheme(t: Theme) {
  const c = document.documentElement.classList;
  c.toggle("light", t === "light");
  c.toggle("dark", t === "dark");
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  listeners.forEach((l) => l());
}
