import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Paths } from '../../../src/services/Paths';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Paths', () => {
  let paths: Paths;
  const testDir = path.join(process.cwd(), 'test-paths');

  beforeEach(() => {
    paths = new Paths({
      productName: 'test-aicli',
      cwd: testDir,
    });
  });

  afterEach(() => {
    // 清理测试目录
    try {
      fs.rmSync(paths.globalProjectDir, { recursive: true, force: true });
    } catch {}
  });

  it('should format path correctly', () => {
    const formatted = (paths as any).formatPath('/Users/curry/my-project');
    expect(formatted).toBe('users-curry-my-project');
  });

  it('should get session log path', () => {
    const logPath = paths.getSessionLogPath('session-123');
    expect(logPath).toContain('session-123.jsonl');
  });

  it('should return empty array when no sessions exist', () => {
    const sessions = paths.getAllSessions();
    expect(sessions).toEqual([]);
  });
});
