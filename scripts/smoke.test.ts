import { describe, expect, it } from 'vitest';
import { checkSite, smoke, type Fetch } from './smoke.ts';

const BASE = 'https://example.test/tangocho/';
const INDEX =
  '<!doctype html><script type="module" crossorigin src="/tangocho/assets/index-AbC123.js"></script>';
const SW = 'define(["./workbox-1a2b"],function(e){e.precacheAndRoute([{url:"index.html"}])});';
const DIST: Record<string, string> = { 'index.html': INDEX, 'sw.js': SW };
const dist = (name: string): string => DIST[name] ?? '';

interface Served {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

/** The mirror as Caddy serves it (ops/Caddyfile), with `changes` applied per file. */
function site(changes: Record<string, Served> = {}): { fetch: Fetch; urls: string[] } {
  const hsts = { 'strict-transport-security': 'max-age=31536000; includeSubDomains' };
  const files: Record<string, Served> = {
    'index.html': { body: INDEX, headers: { 'cache-control': 'no-cache', ...hsts } },
    'sw.js': { body: SW, headers: { 'cache-control': 'no-cache', ...hsts } },
    'manifest.webmanifest': {
      body: '{}',
      headers: {
        'cache-control': 'no-cache',
        'content-type': 'application/manifest+json',
        ...hsts,
      },
    },
    'assets/index-AbC123.js': {
      body: '',
      headers: { 'cache-control': 'public, max-age=31536000, immutable', ...hsts },
    },
  };
  const urls: string[] = [];
  const fetch: Fetch = async (url) => {
    urls.push(url);
    const name = url.slice(BASE.length);
    const missing: Served = {
      status: 404,
      body: 'not found',
      headers: { 'cache-control': 'no-cache', 'content-type': 'text/html; charset=utf-8' },
    };
    const file = { ...(files[name] ?? missing), ...changes[name] };
    // no body rather than '': a string body would bring a text/plain type of its own
    return new Response(file.body || null, {
      status: file.status ?? 200,
      headers: file.headers ?? {},
    });
  };
  return { fetch, urls };
}

describe('checkSite', () => {
  it('passes when the site serves this build with the right headers', async () => {
    const { fetch, urls } = site();
    expect(await checkSite(BASE, dist, fetch)).toEqual([]);
    expect(urls).toEqual([
      `${BASE}index.html`,
      `${BASE}sw.js`,
      `${BASE}manifest.webmanifest`,
      `${BASE}assets/index-AbC123.js`,
      `${BASE}assets/smoke-check-missing.js`,
    ]);
  });

  it('fails when a missing asset is kept for a year', async () => {
    const { fetch } = site({
      'assets/smoke-check-missing.js': {
        headers: {
          'cache-control': 'public, max-age=31536000, immutable',
          'content-type': 'text/html; charset=utf-8',
        },
      },
    });
    expect(await checkSite(BASE, dist, fetch)).toEqual([
      'assets/smoke-check-missing.js: a 404 with cache-control "public, max-age=31536000, immutable"',
    ]);
  });

  it('fails when a 404 has no content type, which Safari offers to download', async () => {
    const { fetch } = site({
      'assets/smoke-check-missing.js': { body: '', headers: { 'cache-control': 'no-cache' } },
    });
    expect(await checkSite(BASE, dist, fetch)).toEqual([
      'assets/smoke-check-missing.js: a 404 with content-type "", expected text/html',
    ]);
  });

  it('fails when a missing asset answers 200, as a catch-all page would', async () => {
    const { fetch } = site({ 'assets/smoke-check-missing.js': { status: 200 } });
    expect(await checkSite(BASE, dist, fetch)).toEqual([
      'assets/smoke-check-missing.js: status 200, expected 404',
    ]);
  });

  it('fails when the page is missing', async () => {
    const { fetch } = site({ 'index.html': { status: 404 } });
    expect(await checkSite(BASE, dist, fetch)).toContain('index.html: status 404, expected 200');
  });

  it('fails when another release is still serving', async () => {
    const old = INDEX.replace('AbC123', 'Old999');
    const { fetch } = site({ 'index.html': { body: old }, 'sw.js': { body: 'define([])' } });
    expect(await checkSite(BASE, dist, fetch)).toEqual([
      'index.html: not this build (another release?)',
      'sw.js: not this build',
    ]);
  });

  it('fails without no-cache on the page, the worker or the manifest', async () => {
    const cached = { 'cache-control': 'max-age=600', 'strict-transport-security': 'max-age=1' };
    const { fetch } = site({
      'index.html': { headers: cached },
      'sw.js': { headers: {} },
      'manifest.webmanifest': { headers: { 'content-type': 'application/manifest+json' } },
    });
    expect(await checkSite(BASE, dist, fetch)).toEqual([
      'index.html: cache-control "max-age=600", expected no-cache',
      'sw.js: cache-control "", expected no-cache',
      'manifest.webmanifest: cache-control "", expected no-cache',
    ]);
  });

  it('fails without HSTS', async () => {
    const { fetch } = site({ 'index.html': { headers: { 'cache-control': 'no-cache' } } });
    expect(await checkSite(BASE, dist, fetch)).toEqual([
      'index.html: no strict-transport-security header',
    ]);
  });

  it('fails when hashed assets are not immutable', async () => {
    const { fetch } = site({
      'assets/index-AbC123.js': { headers: { 'cache-control': 'no-cache' } },
    });
    expect(await checkSite(BASE, dist, fetch)).toEqual([
      'assets/index-AbC123.js: cache-control "no-cache", expected immutable',
    ]);
  });

  it('fails when the manifest has the wrong type', async () => {
    const { fetch } = site({
      'manifest.webmanifest': {
        headers: { 'cache-control': 'no-cache', 'content-type': 'application/octet-stream' },
      },
    });
    expect(await checkSite(BASE, dist, fetch)).toEqual([
      'manifest.webmanifest: content-type "application/octet-stream", expected application/manifest+json',
    ]);
  });
});

describe('smoke', () => {
  const noWait = { wait: async () => {} };

  it('tries again after a failure and passes once the site is right', async () => {
    const good = site().fetch;
    let calls = 0;
    const flaky: Fetch = async (url) => {
      calls++;
      if (calls === 1) throw new Error('connect ECONNRESET');
      return good(url);
    };
    expect(await smoke(BASE, dist, flaky, noWait)).toEqual([]);
  });

  it('reports the last try when every try fails', async () => {
    const { fetch, urls } = site({ 'index.html': { status: 502 } });
    const problems = await smoke(BASE, dist, fetch, { ...noWait, tries: 3 });
    expect(problems).toContain('index.html: status 502, expected 200');
    expect(urls.filter((u) => u.endsWith('index.html'))).toHaveLength(3);
  });

  it('reports a request that never answers', async () => {
    const down: Fetch = async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    };
    expect(await smoke(BASE, dist, down, { ...noWait, tries: 2 })).toEqual([
      'request failed: getaddrinfo ENOTFOUND',
    ]);
  });
});
