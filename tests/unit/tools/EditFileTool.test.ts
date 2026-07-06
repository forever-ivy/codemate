import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditFileTool } from '../../../src/tools/file/EditFileTool';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('EditFileTool', () => {
  let tool: EditFileTool;
  const testFile = path.join(process.cwd(), 'test-edit.txt');

  beforeEach(async () => {
    tool = new EditFileTool();
    // 创建测试文件
    await fs.writeFile(testFile, 'Hello World\nThis is a test', 'utf-8');
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      await fs.unlink(testFile);
    } catch {}
  });

  it('should edit file content', async () => {
    const result = await tool.execute({
      path: testFile,
      oldContent: 'Hello',
      newContent: 'Hi',
    });

    expect(result.success).toBe(true);

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('Hi World');
  });

  it('should support regex replacement', async () => {
    const result = await tool.execute({
      path: testFile,
      oldContent: 'H\\w+',
      newContent: 'Greetings',
      regex: true,
    });

    expect(result.success).toBe(true);

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('Greetings World');
  });

  it('should return false if no changes made', async () => {
    const result = await tool.execute({
      path: testFile,
      oldContent: 'NonExistent',
      newContent: 'Something',
    });

    expect(result.success).toBe(false);
  });

  it('should not write normal progress logs to stdout', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await tool.execute({
      path: testFile,
      oldContent: 'Hello',
      newContent: 'Hi',
    });

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
