import { respond } from "@/lib/server/cache";
import { scenarios } from "@/lib/server/stress";

export const maxDuration = 60;

export async function GET() {
  return respond(() => scenarios(), 24 * 3600);
}
