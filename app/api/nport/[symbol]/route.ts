import { respond } from "@/lib/server/cache";
import { nport } from "@/lib/server/nport";

export const maxDuration = 60;

export async function GET(_: Request, ctx: RouteContext<"/api/nport/[symbol]">) {
  const { symbol } = await ctx.params;
  return respond(async () => (await nport(symbol.toUpperCase())) ?? { symbol, missing: true }, 24 * 3600);
}
