import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'pathe';
import { execSync } from 'node:child_process';

describe('Workspace Integration', () => {
  const testDir = join(process.cwd(), '.test-workspace');

  beforeEach(async () => {
    // 创建测试目录
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    // 初始化 Git 仓库
    execSync('git init');
    execSync('git config user.name "Test User"');
    execSync('git config user.email "test@example.com"');

    // 创建初始提交
    await writeFile(join(testDir, 'README.md'), '# Test');
    execSync('git add README.md');
    execSync('git commit -m "Initial commit"');
  });

  afterEach(async () => {
    process.chdir('..');
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create worktree correctly', () => {
    // 创建工作区
    const workspacePath = join(testDir, '..', 'test-workspace-feature-a');
    execSync(`git worktree add -b feature-a ${workspacePath} main`);

    // 验证工作区
    const output = execSync('git worktree list', { encoding: 'utf-8' });
    expect(output).toContain('feature-a');
    expect(output).toContain(workspacePath);
  });

  it('should list worktrees correctly', () => {
    // 创建多个工作区
    const path1 = join(testDir, '..', 'test-workspace-feature-a');
    const path2 = join(testDir, '..', 'test-workspace-feature-b');

    execSync(`git worktree add -b feature-a ${path1} main`);
    execSync(`git worktree add -b feature-b ${path2} main`);

    // 列出工作区
    const output = execSync('git worktree list', { encoding: 'utf-8' });
    const lines = output.split('\n');

    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('should remove worktree correctly', () => {
    // 创建工作区
    const workspacePath = join(testDir, '..', 'test-workspace-feature-a');
    execSync(`git worktree add -b feature-a ${workspacePath} main`);

    // 删除工作区
    execSync(`git worktree remove ${workspacePath}`);

    // 验证已删除
    const output = execSync('git worktree list', { encoding: 'utf-8' });
    expect(output).not.toContain('feature-a');
  });
});
