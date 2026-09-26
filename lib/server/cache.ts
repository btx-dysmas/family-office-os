// In-memory promise cache: concurrent requests for the same key share one upstream call.
const store = new Map<string, { at: number; value: Promise<unknown> }>();

export const HOUR = 3600;

export function memo<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlSeconds * 1000) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => store.delete(key));
  return value;
}

export const forget = (key: string) => store.delete(key);

/** JSON response cached at the CDN for `fresh` seconds, then served stale while it refreshes. */
export async function respond(load: () => Promise<unknown>, fresh = 6 * HOUR) {
  try {
    const body = await load();
    return Response.json(body, { headers: { "Cache-Control": `public, s-maxage=${fresh}, stale-while-revalidate=${fresh * 4}` } });
  } catch (e) {
    return Response.json({ detail: e instanceof Error ? e.message : "Request failed" }, { status: 502 });
  }
}
