import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTmdbClient } from '../src/catalog/publisher/http.ts';
const token = 'synthetic-secret-never-log';
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
test('transport permits only direct documented endpoints and hides the credential from URLs', async () => {
  let calls = 0;
  const client = createTmdbClient({ token, fetch: async (input, init) => {
    calls++;
    assert.equal(new URL(String(input)).origin, 'https://api.themoviedb.org');
    assert.ok(!String(input).includes(token));
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${token}`);
    assert.equal(init?.redirect, 'error');
    return json({ results: [] });
  } });
  await client.request('/discover/movie', { watch_region: 'US' });
  for (const path of ['https://home-server.example/', '//evil.example/', '/movie/1/../../secret', '/account']) await assert.rejects(client.request(path), /Unsupported/);
  await assert.rejects(client.request('/movie/1', { api_key: token }), /Unsupported/);
  assert.equal(calls, 1);
});
test('429 and server failures retry with capped backoff, then fail without caching', async () => {
  const delays: number[] = [];
  const client = createTmdbClient({ token, sleep: async delay => { delays.push(delay); }, fetch: async () => new Response(token, { status: 429, headers: { 'retry-after': '999999' } }) });
  await assert.rejects(client.request('/movie/1'), error => !String(error).includes(token) && /retry limit/.test(String(error)));
  assert.deepEqual(delays, [10000, 10000]);
  assert.deepEqual(client.statistics(), { attempts: 3, active: 0, cachedResponses: 0 });
  let count = 0;
  const recovered = createTmdbClient({ token, sleep: async () => {}, fetch: async () => ++count === 1 ? new Response('', { status: 503 }) : json({ id: 1 }) });
  assert.deepEqual((await recovered.request('/movie/1')).data, { id: 1 });
  assert.equal(count, 2);
});
test('request budget includes retries and limits total upstream requests', async () => {
  const client = createTmdbClient({ token, requestBudget: 2, sleep: async () => {}, fetch: async () => new Response('', { status: 503 }) });
  await assert.rejects(client.request('/movie/1'), /budget exhausted/);
  assert.equal(client.statistics().attempts, 2);
});
test('successful cache preserves real check time and never serves expired data after failure', async () => {
  let time = Date.parse('2026-09-29T12:00:00Z'), calls = 0;
  const client = createTmdbClient({ token, now: () => time, cacheTtlMs: 1000, fetch: async () => {
    if (++calls > 1) throw new Error(token);
    return json({ id: 1 });
  } });
  const first = await client.request('/movie/1');
  time += 999;
  assert.deepEqual(await client.request('/movie/1'), first);
  assert.equal(calls, 1);
  time++;
  await assert.rejects(client.request('/movie/1'), error => /transport failed/.test(String(error)) && !String(error).includes(token));
  assert.equal(calls, 2);
});
test('concurrency never exceeds four and every slot is released after failures', async () => {
  let active = 0, peak = 0;
  const client = createTmdbClient({ token, fetch: async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return json({});
  } });
  await Promise.all(Array.from({ length: 12 }, (_, i) => client.request(`/movie/${i + 1}`)));
  assert.equal(peak, 4);
  assert.equal(client.statistics().active, 0);
});
test('malformed and oversized bodies never enter the cache or leak input', async () => {
  for (const body of [token, 'x'.repeat(1024 * 1024 + 1)]) {
    const client = createTmdbClient({ token, fetch: async () => new Response(body) });
    await assert.rejects(client.request('/movie/1'), /Invalid upstream response/);
    assert.equal(client.statistics().cachedResponses, 0);
  }
});
test('response cache has a fixed entry budget', async () => {
  const client = createTmdbClient({ token, fetch: async () => json({}) });
  for (let id = 1; id <= 140; id++) await client.request(`/movie/${id}`);
  assert.equal(client.statistics().cachedResponses, 128);
});
