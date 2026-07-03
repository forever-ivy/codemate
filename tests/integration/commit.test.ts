import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'pathe';
import { execSync } from 'node:child_process';

describe('Commit Integration', () => {
  const testDir = join(process.cwd(), '.test-commit');

  beforeEach(async () => {
    // 创建测试目录
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    // 初始化 Git 仓库
    execSync('git init');
    execSync('git config user.name "Test User"');
    execSync('git config user.email "test@example.com"');
  });

  afterEach(async () => {
    process.chdir('..');
    await rm(testDir, { recursive: true, force: true });
  });

  it('should read git diff correctly', async () => {
    // 创建文件并添加到 Git
    await writeFile(join(testDir, 'test.ts'), 'console.log("hello");');
    execSync('git add test.ts');

    // 读取 diff
    const diff = execSync('git diff --cached', { encoding: 'utf-8' });

    expect(diff).toContain('test.ts');
    expect(diff).toContain('console.log("hello")');
  });

  it('should read commit history correctly', async () => {
    // 创建初始提交
    await writeFile(join(testDir, 'file1.ts'), 'content1');
    execSync('git add file1.ts');
    execSync('git commit -m "feat: add file1"');

    await writeFile(join(testDir, 'file2.ts'), 'content2');
    execSync('git add file2.ts');
    execSync('git commit -m "fix: add file2"');

    // 读取历史
    const history = execSync('git log -2 --pretty=format:"%s"', { encoding: 'utf-8' });

    expect(history).toContain('feat: add file1');
    expect(history).toContain('fix: add file2');
  });

  it('should handle empty diff', async () => {
    // 没有任何更改
    const diff = execSync('git diff --cached', { encoding: 'utf-8' });

    expect(diff).toBe('');
  });

  it('should handle unstaged changes', async () => {
    // 创建文件并先提交
    await writeFile(join(testDir, 'test.ts'), 'console.log("hello");');
    execSync('git add test.ts');
    execSync('git commit -m "initial commit"');

    // 修改文件但不 stage
    await writeFile(join(testDir, 'test.ts'), 'console.log("world");');

    // 读取 unstaged diff
    const diff = execSync('git diff', { encoding: 'utf-8' });

    expect(diff).toContain('test.ts');
    expect(diff).toContain('world');
  });
});
