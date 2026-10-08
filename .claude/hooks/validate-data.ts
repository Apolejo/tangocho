/**
 * PostToolUse hook, wired in .claude/settings.json: after Claude edits or writes a file under
 * data/, runs the validator and reports back. Errors exit with code 2, which hands the report
 * to Claude as feedback; warnings travel as additionalContext; any other file exits 0 at once.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

interface HookInput {
  cwd?: string;
  tool_input?: { file_path?: string };
}

function readInput(): HookInput {
  try {
    return JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  } catch {
    return {};
  }
}

/** The edited file's path relative to the project root if it is inside data/, else undefined. */
function insideData(file: string, root: string): string | undefined {
  const rel = relative(resolve(root), resolve(file));
  if (rel === '' || isAbsolute(rel)) return undefined;
  const parts = rel.split(sep);
  return parts.length > 1 && parts[0] === 'data' ? parts.join('/') : undefined;
}

function main(): number {
  const input = readInput();
  const root = process.env['CLAUDE_PROJECT_DIR'] ?? input.cwd ?? process.cwd();
  const file = input.tool_input?.file_path;
  const edited = file === undefined ? undefined : insideData(file, root);
  if (edited === undefined) return 0;

  const result = spawnSync(process.execPath, [join(root, 'scripts', 'validate.ts')], {
    cwd: root,
    encoding: 'utf8',
  });
  const output = `${result.stdout}${result.stderr}`.trim();

  if (result.status !== 0) {
    process.stderr.write(`npm run validate failed after editing ${edited}:\n${output}\n`);
    return 2;
  }

  const warnings = output.split('\n').filter((line) => line.includes('⚠'));
  if (warnings.length > 0) {
    const context = `npm run validate after editing ${edited}: ${warnings.length} warning(s), no errors\n${warnings.join('\n')}`;
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
      }),
    );
  }
  return 0;
}

process.exitCode = main();
