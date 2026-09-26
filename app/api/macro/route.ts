import { respond } from "@/lib/server/cache";
import { macro } from "@/lib/server/macro";

export const maxDuration = 60;

export async function GET() {
  const res = await respond(() => macro(), 6 * 3600);
  const body = await res.clone().json().catch(() => null);
  if (!body?.available) res.headers.set("Cache-Control", "no-store"); // never cache a response without FRED data
  return res;
}
