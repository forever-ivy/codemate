import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { FileSafetyPolicy } from '../../../src/tools/FileSafetyPolicy';

describe('FileSafetyPolicy', () => {
  const cwd = process.cwd();

  it('should allow file mutations inside the workspace', () => {
    const policy = new FileSafetyPolicy();

    expect(policy.check('write_file', { path: 'src/example.ts' }, cwd)).toEqual({
      allowed: true,
      path: path.join(cwd, 'src/example.ts'),
      reason: 'Path is inside the workspace.',
    });
  });

  it('should reject file mutations outside the workspace', () => {
    const policy = new FileSafetyPolicy();

    const decision = policy.check('write_file', { path: '../outside.txt' }, cwd);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('outside the workspace');
  });

  it('should reject file mutations inside protected directories', () => {
    const policy = new FileSafetyPolicy();

    expect(policy.check('delete_file', { path: '.git/config' }, cwd)).toEqual({
      allowed: false,
      path: path.join(cwd, '.git/config'),
      reason: 'Refusing to modify protected directory: .git',
    });
  });

  it('should ignore tools that do not mutate files', () => {
    const policy = new FileSafetyPolicy();

    expect(policy.check('read_file', { path: '../outside.txt' }, cwd)).toEqual({
      allowed: true,
      reason: 'Tool does not mutate files.',
    });
  });

  it('should reject apply_patch when any target is protected', () => {
    const policy = new FileSafetyPolicy();
    const patch = [
      '--- a/src/ok.ts',
      '+++ b/src/ok.ts',
      '@@ -0,0 +1 @@',
      '+ok',
      '--- a/.git/config',
      '+++ b/.git/config',
      '@@ -0,0 +1 @@',
      '+bad',
      '',
    ].join('\n');

    const decision = policy.check('apply_patch', { patch }, cwd);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('protected directory: .git');
  });
});
