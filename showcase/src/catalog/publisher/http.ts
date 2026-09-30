// Build-time only. There is deliberately no CLI live-source entry point until
// project-specific source permission, retention and credentials are approved.
export interface CheckedResponse { data: unknown; checkedAt: string }
export type CatalogRequest = (path: string, query?: Record<string, string>) => Promise<CheckedResponse>;
export interface ClientOptions {
  token: string;
  fetch: typeof globalThis.fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  cache?: Map<string, CheckedResponse>;
  concurrency?: number;
  requestBudget?: number;
  cacheTtlMs?: number;
}
export function createTmdbClient(options: ClientOptions) {
  if (!options.token || /[\r\n]/.test(options.token)) throw new Error('Missing or invalid build-time credential');
  const limit = options.concurrency ?? 4;
  const budget = options.requestBudget ?? 5000;
  const ttl = options.cacheTtlMs ?? 3600000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 4 || !Number.isInteger(budget) || budget < 1 || budget > 5000 || ttl < 0 || ttl > 3600000) throw new Error('Invalid upstream resource limits');
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const cache = options.cache ?? new Map<string, CheckedResponse>();
  let active = 0, attempts = 0;
  const waiters: (() => void)[] = [];
  const request: CatalogRequest = async (path, query = {}) => {
    if (!/^\/(watch\/providers\/(movie|tv)|discover\/(movie|tv)|(movie|tv)\/[1-9]\d*(\/watch\/providers)?)$/.test(path)) throw new Error('Unsupported upstream endpoint');
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    for (const key of Object.keys(query).sort()) {
      if (!['watch_region', 'region', 'language', 'with_watch_providers', 'with_watch_monetization_types', 'include_adult', 'sort_by', 'page'].includes(key)) throw new Error('Unsupported upstream parameter');
      url.searchParams.set(key, query[key]);
    }
    const key = url.href;
    const hit = cache.get(key);
    if (hit) {
      const age = now() - Date.parse(hit.checkedAt);
      if (Number.isFinite(age) && age >= 0 && age < ttl) return structuredClone(hit);
    }
    if (active >= limit) await new Promise<void>(resolve => waiters.push(resolve));
    else active++;
    try {
      for (let retry = 0; retry < 3; retry++) {
        if (attempts >= budget) throw new Error('Upstream request budget exhausted');
        attempts++;
        let response: Response;
        try {
          response = await options.fetch(url, { headers: { Authorization: `Bearer ${options.token}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
        } catch { throw new Error('Upstream transport failed'); }
        if (response.status === 429 || response.status >= 500) {
          await response.body?.cancel();
          if (retry === 2) throw new Error('Upstream retry limit reached');
          const header = response.headers.get('retry-after');
          const seconds = header ? Number(header) : NaN;
          const requested = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - now() : 0;
          await sleep(Math.min(10000, Math.max(500 * 2 ** retry, Number.isFinite(requested) ? requested : 0)));
          continue;
        }
        if (!response.ok) { await response.body?.cancel(); throw new Error(`Upstream HTTP ${response.status}`); }
        // Bound response reads even when Content-Length is absent or dishonest.
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Empty upstream response');
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 1024 * 1024) { await reader.cancel(); throw new Error('Oversized response'); }
            chunks.push(value);
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          const result = { data: JSON.parse(new TextDecoder().decode(bytes)), checkedAt: new Date(now()).toISOString() };
          // Bound retained responses as well as request count. The future live
          // scheduler owns any approved persistent cache/retention policy.
          while (cache.size >= 128) cache.delete(cache.keys().next().value!);
          cache.set(key, structuredClone(result));
          return result;
        } catch { throw new Error('Invalid upstream response'); }
      }
      throw new Error('Upstream retry limit reached');
    } finally {
      const next = waiters.shift();
      if (next) next(); else active--;
    }
  };
  return { request, statistics: () => ({ attempts, active, cachedResponses: cache.size }) };
}
