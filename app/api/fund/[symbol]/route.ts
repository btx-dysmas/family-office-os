import { respond } from "@/lib/server/cache";
import { fund } from "@/lib/server/yahoo";

export async function GET(_: Request, ctx: RouteContext<"/api/fund/[symbol]">) {
  const { symbol } = await ctx.params;
  return respond(async () => {
    const f = await fund(symbol.toUpperCase());
    if (!f) throw new Error(`No fund data for ${symbol}`);
    return f;
  }, 12 * 3600);
}
