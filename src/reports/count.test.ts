import { describe, expect, it } from 'vitest';
import { countOpenReports, OPEN_REPORTS_API, type Fetch } from './count.ts';

const respond =
  (body: unknown, status = 200): Fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('countOpenReports', () => {
  it('asks GitHub for the open issues labelled word-report', async () => {
    let asked: string | undefined;
    await countOpenReports((url) => {
      asked = url;
      return Promise.resolve(new Response('[]'));
    });
    expect(asked).toBe(OPEN_REPORTS_API);
    const url = new URL(OPEN_REPORTS_API);
    expect(url.origin + url.pathname).toBe('https://api.github.com/repos/Apolejo/tangocho/issues');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      labels: 'word-report',
      state: 'open',
      per_page: '100',
    });
  });

  it('counts the issues and skips pull requests', async () => {
    const list = [{ number: 1 }, { number: 2, pull_request: { url: 'x' } }, { number: 3 }];
    expect(await countOpenReports(respond(list))).toBe(2);
    expect(await countOpenReports(respond([]))).toBe(0);
  });

  it('gives no answer when anything goes wrong', async () => {
    expect(await countOpenReports(respond({ message: 'rate limited' }, 403))).toBeUndefined();
    expect(await countOpenReports(respond({ not: 'a list' }))).toBeUndefined();
    expect(
      await countOpenReports(() => Promise.resolve(new Response('<html>', { status: 200 }))),
    ).toBeUndefined();
    expect(await countOpenReports(() => Promise.reject(new TypeError('offline')))).toBeUndefined();
  });

  it('gives up after the timeout', async () => {
    const hang: Fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted')));
      });
    expect(await countOpenReports(hang, 10)).toBeUndefined();
  });
});
