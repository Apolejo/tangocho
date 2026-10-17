import { expect } from './test.ts';

/**
 * A ⚑'s mailto: link read the way a mail app does (SPEC §5.7): who it goes to, the subject, and
 * the "Label: value" lines under the body's "---".
 */
export function readReport(href: string | null): {
  to: string;
  subject: string;
  fields: Record<string, string>;
} {
  const url = new URL(href ?? '');
  expect(url.protocol).toBe('mailto:');
  const lines = (url.searchParams.get('body') ?? '').split('\r\n');
  const fields: Record<string, string> = {};
  for (const line of lines.slice(lines.indexOf('---') + 2)) {
    const colon = line.indexOf(': ');
    fields[line.slice(0, colon)] = line.slice(colon + 2);
  }
  return { to: url.pathname, subject: url.searchParams.get('subject') ?? '', fields };
}
