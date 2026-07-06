import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GrepTool } from '../../../src/tools/search/GrepTool';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('GrepTool', () => {
  let tool: GrepTool;
  const testFile = path.join(process.cwd(), 'test-grep.txt');

  beforeEach(async () => {
    tool = new GrepTool();
    await fs.writeFile(
      testFile,
      'Line 1: TODO fix this\nLine 2: normal line\nLine 3: TODO another task',
      'utf-8'
    );
  });

  afterEach(async () => {
    try {
      await fs.unlink(testFile);
    } catch {}
  });

  it('should search for text in file', async () => {
    const result = await tool.execute({
      pattern: 'TODO',
      path: testFile,
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.matches[0].content).toContain('TODO');
  });

  it('should support case insensitive search', async () => {
    const result = await tool.execute({
      pattern: 'todo',
      path: testFile,
      caseSensitive: false,
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('should support regex search', async () => {
    const result = await tool.execute({
      pattern: 'Line \\d+',
      path: testFile,
      regex: true,
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
  });
});
