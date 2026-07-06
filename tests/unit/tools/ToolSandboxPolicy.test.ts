import { describe, expect, it } from 'vitest';
import { ToolSandboxPolicy } from '../../../src/tools/ToolSandboxPolicy';

describe('ToolSandboxPolicy', () => {
  const cwd = process.cwd();

  it('should allow read-only file tools inside the workspace', () => {
    const policy = new ToolSandboxPolicy();

    expect(policy.check('read_file', { path: 'package.json' }, cwd)).toEqual({
      status: 'allow',
      category: 'file',
      reason: 'Read-only file access stays inside the workspace.',
    });
  });

  it('should deny file tools that target paths outside the workspace', () => {
    const policy = new ToolSandboxPolicy();

    const decision = policy.check('write_file', { path: '../outside.txt' }, cwd);

    expect(decision).toEqual({
      status: 'deny',
      category: 'file',
      reason: expect.stringContaining('outside the workspace'),
    });
  });

  it('should inspect every path in an apply_patch call', () => {
    const policy = new ToolSandboxPolicy();
    const patch = [
      '--- a/src/ok.ts',
      '+++ b/src/ok.ts',
      '@@ -0,0 +1 @@',
      '+ok',
      '--- a/../outside.ts',
      '+++ b/../outside.ts',
      '@@ -0,0 +1 @@',
      '+bad',
      '',
    ].join('\n');

    expect(policy.check('apply_patch', { patch }, cwd)).toEqual({
      status: 'deny',
      category: 'file',
      reason: 'File tool target is outside the workspace: ../outside.ts',
    });
  });

  it('should require approval for shell commands by default', () => {
    const policy = new ToolSandboxPolicy();

    expect(policy.check('bash', { command: 'pnpm run typecheck' }, cwd)).toEqual({
      status: 'requires_approval',
      category: 'shell',
      reason: 'Shell commands can change machine state and require explicit approval.',
    });
  });

  it('should deny shell commands with destructive patterns', () => {
    const policy = new ToolSandboxPolicy();

    expect(policy.check('bash', { command: 'rm -rf dist' }, cwd)).toEqual({
      status: 'deny',
      category: 'shell',
      reason: 'Shell command matches a destructive pattern.',
    });
  });

  it('should deny network access to local and metadata addresses', () => {
    const policy = new ToolSandboxPolicy();

    expect(policy.check('fetch', { url: 'http://169.254.169.254/latest/meta-data' }, cwd)).toEqual({
      status: 'deny',
      category: 'network',
      reason: 'Network access to local, private, or metadata addresses is blocked.',
    });
  });
});
