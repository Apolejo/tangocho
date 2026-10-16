import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * The deploy user's forced command on the Oracle VM (docs/ORACLE.md), run for real in a temporary
 * folder. Linux only, like the server: CI runs it; on Windows it's skipped.
 */

const SCRIPT = fileURLToPath(new URL('../ops/tangocho-deploy.sh', import.meta.url));

const sha = (n: number): string => n.toString(16).padStart(40, '0');

describe.skipIf(process.platform === 'win32')('tangocho-deploy', () => {
  let root: string;
  let rrsync: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tangocho-deploy-'));
    mkdirSync(join(root, 'incoming'));
    mkdirSync(join(root, 'releases'));
    rrsync = join(root, 'rrsync-stub');
    writeFileSync(rrsync, '#!/bin/sh\necho "rrsync $*"\n');
    chmodSync(rrsync, 0o755);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const run = (command: string) => {
    const result = spawnSync('bash', [SCRIPT], {
      env: {
        PATH: process.env.PATH,
        SSH_ORIGINAL_COMMAND: command,
        TANGOCHO_ROOT: root,
        RRSYNC: rrsync,
      },
      encoding: 'utf8',
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  };
  const activate = (n: number) => run(`activate ${sha(n)}`);

  const incoming = (...parts: string[]): string => join(root, 'incoming', ...parts);
  /** Build `n` as rsync leaves it in incoming/: every file replaced, never rewritten in place. */
  const upload = (n: number, { leaveOut = [] as string[], urls = true } = {}) => {
    rmSync(incoming(), { recursive: true, force: true });
    mkdirSync(incoming('assets'), { recursive: true });
    const files: Record<string, string> = {
      'index.html': `<script src="/tangocho/assets/index-${n}.js"></script>`,
      'manifest.webmanifest': '{"name":"単語帳"}',
      [`assets/index-${n}.js`]: `build ${n}`,
      [`workbox-${n}.js`]: 'workbox',
      'sw.js': `define(["./workbox-${n}"],function(e){e.precacheAndRoute(${
        urls
          ? `[{url:"assets/index-${n}.js",revision:null},{url:"index.html",revision:"${n}"},{url:"manifest.webmanifest",revision:"1"}]`
          : '[]'
      })});`,
    };
    for (const [name, text] of Object.entries(files)) {
      if (!leaveOut.includes(name)) writeFileSync(incoming(name), text);
    }
  };

  const serving = (): string => readlinkSync(join(root, 'current'));
  const releases = (): string[] => readdirSync(join(root, 'releases')).sort();
  const served = (name: string): string => readFileSync(join(root, 'current', name), 'utf8');
  const state = () => ({
    current: existsSync(join(root, 'current')) ? serving() : null,
    releases: releases(),
  });

  it('copies a complete upload into releases/<sha> and serves it', () => {
    upload(1);
    const result = activate(1);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`serving ${sha(1)}`);
    expect(serving()).toBe(`releases/${sha(1)}`);
    expect(served('assets/index-1.js')).toBe('build 1');
    // hard links: a release costs no space for the files it shares with the upload
    expect(statSync(join(root, 'releases', sha(1), 'sw.js')).ino).toBe(
      statSync(incoming('sw.js')).ino,
    );
  });

  it('switches to the next release and keeps the previous one intact', () => {
    upload(1);
    activate(1);
    upload(2);
    expect(activate(2).status).toBe(0);
    expect(serving()).toBe(`releases/${sha(2)}`);
    expect(served('assets/index-2.js')).toBe('build 2');
    expect(readFileSync(join(root, 'releases', sha(1), 'assets/index-1.js'), 'utf8')).toBe(
      'build 1',
    );
  });

  it('rolls back to a release it already has, whatever incoming/ holds', () => {
    upload(1);
    activate(1);
    upload(2);
    activate(2);
    expect(activate(1).status).toBe(0);
    expect(serving()).toBe(`releases/${sha(1)}`);
    expect(served('index.html')).toContain('index-1.js');
  });

  it('activates the same release again without harm', () => {
    upload(1);
    activate(1);
    expect(activate(1).status).toBe(0);
    expect(state()).toEqual({ current: `releases/${sha(1)}`, releases: [sha(1)] });
  });

  it.each([
    'activate',
    'activate ../x',
    'activate abc123',
    `activate ${'G'.repeat(40)}`,
    `activate ${sha(2)} x`,
  ])('refuses "%s"', (command) => {
    upload(1);
    activate(1);
    upload(2);
    const before = state();
    const result = run(command);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/full commit sha|allowed/);
    expect(state()).toEqual(before);
  });

  it.each(['', 'ls', 'rm -rf /', 'rsync --sender .', 'scp -t .'])(
    'refuses the command "%s"',
    (command) => {
      const result = run(command);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('allowed: rsync into incoming/, or activate <sha>');
    },
  );

  it('hands rsync to rrsync, write-only into incoming/ with symlinks munged', () => {
    const result = run('rsync --server -rce.iLsfxCIvu --delete . .');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`rrsync -wo -munge ${root}/incoming`);
  });

  describe('refuses an incomplete upload and keeps serving the previous release', () => {
    const refused = (setup: () => void, message: string) => {
      upload(1);
      activate(1);
      setup();
      const before = state();
      const result = activate(2);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
      expect(result.stderr).toContain(`still serving releases/${sha(1)}`);
      expect(state()).toEqual(before);
      expect(readdirSync(join(root, 'releases'))).not.toContain(`.tmp.${sha(2)}`);
    };

    it('when a precached file is missing', () => {
      refused(() => upload(2, { leaveOut: ['assets/index-2.js'] }), 'missing assets/index-2.js');
    });

    it('when half of it arrived: the new page and worker over the old assets', () => {
      refused(() => {
        writeFileSync(
          incoming('index.html'),
          '<script src="/tangocho/assets/index-2.js"></script>',
        );
        writeFileSync(
          incoming('sw.js'),
          'define(["./workbox-2"],function(e){e.precacheAndRoute([{url:"assets/index-2.js",revision:null}])});',
        );
      }, 'missing assets/index-2.js');
    });

    it('when the Workbox runtime is missing', () => {
      refused(() => upload(2, { leaveOut: ['workbox-2.js'] }), 'missing workbox-2.js');
    });

    it('when the page is missing', () => {
      refused(() => upload(2, { leaveOut: ['index.html'] }), 'missing index.html');
    });

    it('when sw.js lists no files, so nothing could be checked', () => {
      refused(() => upload(2, { urls: false }), 'sw.js lists no precached files');
    });

    it('when it holds a symlink, which Caddy would follow out of the web root', () => {
      refused(() => {
        upload(2);
        symlinkSync('/etc/passwd', incoming('assets', 'leak.txt'));
      }, 'not a file or folder: assets/leak.txt');
    });
  });

  it('keeps the five most recently activated releases', () => {
    for (let n = 1; n <= 7; n++) {
      upload(n);
      expect(activate(n).status).toBe(0);
    }
    expect(releases()).toEqual([3, 4, 5, 6, 7].map(sha));
    expect(serving()).toBe(`releases/${sha(7)}`);
  });

  it('never removes the release it serves, even when the clock makes it look oldest', () => {
    for (let n = 1; n <= 5; n++) {
      upload(n);
      activate(n);
      const future = new Date(Date.now() + n * 86_400_000);
      utimesSync(join(root, 'releases', sha(n)), future, future);
    }
    upload(6);
    expect(activate(6).status).toBe(0);
    expect(serving()).toBe(`releases/${sha(6)}`);
    expect(releases()).toEqual([1, 2, 3, 4, 5, 6].map(sha));
  });

  it('cleans up a copy left by an interrupted activation', () => {
    mkdirSync(join(root, 'releases', `.tmp.${sha(9)}`));
    upload(1);
    expect(activate(1).status).toBe(0);
    expect(readdirSync(join(root, 'releases'))).toEqual([sha(1)]);
  });
});
