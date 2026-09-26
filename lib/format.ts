export const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const DASH = "—";

/** Compact currency: $1.24M, $860K, $12,400. */
export function money(v: number | null | undefined, dp = 1) {
  if (!ok(v)) return DASH;
  const a = Math.abs(v), s = v <= -0.5 ? "-" : "";
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(dp + 1)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(dp + 1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : dp + 1)}M`;
  if (a >= 1e4) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
/** Full currency: $1,240,500. */
export const usd = (v: number | null | undefined, dp = 0) =>
  ok(v) ? `${v <= -0.5 * 10 ** -dp ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}` : DASH;
export const pct = (v: number | null | undefined, dp = 1, sign = false) => {
  if (!ok(v)) return DASH;
  const x = Math.abs(v * 100) < 0.5 * 10 ** -dp ? 0 : v * 100; // no "-0.0%"
  return `${sign && x > 0 ? "+" : ""}${x.toFixed(dp)}%`;
};
export const num = (v: number | null | undefined, dp = 2) =>
  ok(v) ? (Math.abs(v) < 0.5 * 10 ** -dp ? 0 : v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : DASH;
export const tone = (v: number | null | undefined) => (!ok(v) || v === 0 ? "" : v > 0 ? "text-pos" : "text-neg");

export const today = () => new Date().toISOString().slice(0, 10);
export const thisYear = () => new Date().getFullYear();
export const date = (d: string | null | undefined) =>
  d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : DASH;
export const ageOn = (dob: string, on = today()) => {
  const [y, m, d] = dob.split("-").map(Number), [Y, M, D] = on.split("-").map(Number);
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0);
};
export const daysUntil = (d: string, from = today()) => Math.round((Date.parse(d) - Date.parse(from)) / 864e5);
/** Days until the next birthday (0 = today). */
export const nextBirthday = (dob: string, from = today()) => {
  const y = Number(from.slice(0, 4));
  let next = `${y}${dob.slice(4)}`;
  if (next < from) next = `${y + 1}${dob.slice(4)}`;
  return daysUntil(next, from);
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
