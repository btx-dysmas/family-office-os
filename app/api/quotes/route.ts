import { respond } from "@/lib/server/cache";
import { quote } from "@/lib/server/yahoo";

const list = (req: Request, max: number) =>
  [...new Set((new URL(req.url).searchParams.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => s && !s.startsWith("$")))].slice(0, max);

// Latest price and previous close for up to 80 symbols.
export async function GET(req: Request) {
  const symbols = list(req, 80);
  return respond(async () => Object.fromEntries((await Promise.all(symbols.map((s) => quote(s).catch(() => null)))).filter(Boolean).map((q) => [q!.symbol, q])), 900);
}
