import { z } from 'zod';
import { REPO, REPORT_LABEL } from './report.ts';

/**
 * How many word reports are open (SPEC §5.7): one request to GitHub's public API at launch, the
 * app's only request to another site. Any failure means no answer, and nothing shows.
 */

export const OPEN_REPORTS_API = `https://api.github.com/repos/${REPO}/issues?${new URLSearchParams({
  labels: REPORT_LABEL,
  state: 'open',
  per_page: '100',
}).toString()}`;

/** Gives up after this long: a slow network never holds anything up. */
export const TIMEOUT_MS = 5000;

/** The issues endpoint lists pull requests too; those carry a `pull_request` field. */
const IssueList = z.array(z.object({ pull_request: z.unknown().optional() }));

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export async function countOpenReports(
  fetchFn: Fetch = (url, init) => fetch(url, init),
  timeoutMs = TIMEOUT_MS,
): Promise<number | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(OPEN_REPORTS_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const issues = IssueList.safeParse(await response.json());
    if (!issues.success) return undefined;
    return issues.data.filter((issue) => issue.pull_request === undefined).length;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

let atLaunch: Promise<number | undefined> | undefined;

/** The count, asked once per launch; offline, nothing is asked. */
export function openReportsAtLaunch(): Promise<number | undefined> {
  atLaunch ??= navigator.onLine ? countOpenReports() : Promise.resolve(undefined);
  return atLaunch;
}
