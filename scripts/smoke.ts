/**
 * After a deploy to the Oracle mirror (docs/ORACLE.md): fails unless the site serves this build
 * over HTTPS, with the headers the service worker relies on. Run by the deploy workflow:
 *   node scripts/smoke.ts https://apolejo.dev/tangocho/ dist
 * One line per problem; exit code 1 if there are any after the last try.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Fetch = (url: string) => Promise<Response>;

/** Reads a file of the build that was just deployed, such as `index.html`. */
export type ReadDist = (name: string) => string;

const NO_CACHE = /(^|,)\s*no-cache\s*(,|$)/;
const IMMUTABLE = /(^|,)\s*immutable\s*(,|$)/;
const MISSING = 'assets/smoke-check-missing.js';

/** What's wrong with the site at `base` (ending in a slash), or nothing. */
export async function checkSite(base: string, dist: ReadDist, fetchFn: Fetch): Promise<string[]> {
  const problems: string[] = [];
  const get = async (name: string, status = 200) => {
    const response = await fetchFn(new URL(name, base).href);
    const body = await response.text();
    if (response.status !== status) {
      problems.push(`${name}: status ${response.status}, expected ${status}`);
    }
    return { headers: response.headers, body };
  };
  const cacheControl = (name: string, headers: Headers, rule: RegExp, expected: string) => {
    const value = headers.get('cache-control') ?? '';
    if (!rule.test(value)) problems.push(`${name}: cache-control "${value}", expected ${expected}`);
  };

  const index = await get('index.html');
  cacheControl('index.html', index.headers, NO_CACHE, 'no-cache');
  if (!index.headers.get('strict-transport-security')) {
    problems.push('index.html: no strict-transport-security header');
  }
  const expectedIndex = dist('index.html');
  if (index.body !== expectedIndex) problems.push('index.html: not this build (another release?)');

  const worker = await get('sw.js');
  cacheControl('sw.js', worker.headers, NO_CACHE, 'no-cache');
  if (worker.body !== dist('sw.js')) problems.push('sw.js: not this build');

  const manifest = await get('manifest.webmanifest');
  cacheControl('manifest.webmanifest', manifest.headers, NO_CACHE, 'no-cache');
  const type = manifest.headers.get('content-type') ?? '';
  if (!type.startsWith('application/manifest+json')) {
    problems.push(
      `manifest.webmanifest: content-type "${type}", expected application/manifest+json`,
    );
  }

  // the build's entry script, named by its hash: index.html links it as /tangocho/assets/index-<hash>.js
  const asset = /src="[^"]*\/(assets\/[^"]+\.js)"/.exec(expectedIndex)?.[1];
  if (asset === undefined) {
    problems.push('index.html: names no script under assets/');
  } else {
    const script = await get(asset);
    cacheControl(asset, script.headers, IMMUTABLE, 'immutable');
  }

  // a browser that asks for an asset before its release is live must not keep the 404
  const missing = await get(MISSING, 404);
  const missingCache = missing.headers.get('cache-control') ?? '';
  if (IMMUTABLE.test(missingCache)) {
    problems.push(`${MISSING}: a 404 with cache-control "${missingCache}"`);
  }
  // and a mistyped address must show a page: an untyped 404 under nosniff makes Safari offer a download
  const missingType = missing.headers.get('content-type') ?? '';
  if (!missingType.startsWith('text/html')) {
    problems.push(`${MISSING}: a 404 with content-type "${missingType}", expected text/html`);
  }
  return problems;
}

/** checkSite until it passes or `tries` run out; returns the last try's problems. */
export async function smoke(
  base: string,
  dist: ReadDist,
  fetchFn: Fetch,
  { tries = 3, delayMs = 2000, wait = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {},
): Promise<string[]> {
  let problems: string[] = [];
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      problems = await checkSite(base, dist, fetchFn);
    } catch (e) {
      problems = [`request failed: ${e instanceof Error ? e.message : String(e)}`];
    }
    if (problems.length === 0 || attempt === tries) break;
    await wait(delayMs);
  }
  return problems;
}

if (import.meta.main) {
  const [url, distDir] = process.argv.slice(2);
  if (url === undefined || distDir === undefined) {
    console.error('usage: node scripts/smoke.ts <site url> <dist folder>');
    process.exit(2);
  }
  const base = url.endsWith('/') ? url : `${url}/`;
  const problems = await smoke(
    base,
    (name) => readFileSync(join(distDir, name), 'utf8'),
    (u) => fetch(u, { cache: 'no-store' }),
  );
  for (const problem of problems) console.error(problem);
  console.info(
    problems.length === 0 ? `smoke: ${base} serves this build` : `smoke: ${base} failed`,
  );
  process.exitCode = problems.length === 0 ? 0 : 1;
}
