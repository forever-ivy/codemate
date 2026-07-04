import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeEditor } from '../../../src/code/CodeEditor';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('CodeEditor', () => {
  const editor = new CodeEditor();
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-code-editor');
    await fs.mkdir(testDir, { recursive: true });
    testFile = path.join(testDir, 'test.js');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略错误
    }
  });

  it('should edit function', async () => {
    // 创建测试文件
    const originalCode = `
function add(a, b) {
  return a + b;
}
    `.trim();

    await fs.writeFile(testFile, originalCode, 'utf-8');

    // 编辑函数
    const newCode = `
function add(a, b) {
  return a + b + 1;
}
    `.trim();

    const result = await editor.edit(testFile, 'add', 'function', newCode);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Successfully edited');

    // 验证文件内容
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('a + b + 1');
  });

  it('should reject invalid syntax', async () => {
    const originalCode = 'function add(a, b) { return a + b; }';
    await fs.writeFile(testFile, originalCode, 'utf-8');

    const invalidCode = 'function add(a, b) { return a + ; }'; // 语法错误

    const result = await editor.edit(testFile, 'add', 'function', invalidCode);

    expect(result.success).toBe(false);
    expect(result.message).toContain('syntax errors');
  });

  it('should handle non-existent target', async () => {
    const originalCode = 'function add(a, b) { return a + b; }';
    await fs.writeFile(testFile, originalCode, 'utf-8');

    const newCode = 'function subtract(a, b) { return a - b; }';

    const result = await editor.edit(testFile, 'subtract', 'function', newCode);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});
