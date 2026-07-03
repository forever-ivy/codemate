import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '../../src/application/Application';
import { ConfigService } from '../../src/services/ConfigService';
import type { SessionService } from '../../src/services/SessionService';
import * as fs from 'node:fs/promises';
import * as path from 'pathe';

describe('UI Integration', () => {
  let app: Application;
  let sessionService: SessionService;
  let sessionDir: string;

  beforeEach(async () => {
    // 创建应用
    const configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });
    app = new Application(undefined, configService);
    await app.start();

    // 获取 SessionService
    sessionService = app.getContainer().get<SessionService>('session');

    // 初始化
    await sessionService.initialize();

    // 获取会话目录路径
    const paths = app.getContainer().get<any>('paths');
    sessionDir = paths.globalProjectDir;

    // 清理现有会话文件
    try {
      const files = await fs.readdir(sessionDir);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          await fs.unlink(path.join(sessionDir, file));
        }
      }
    } catch (error) {
      // 目录可能不存在，忽略错误
    }
  });

  afterEach(async () => {
    // 清理测试创建的会话文件
    try {
      const files = await fs.readdir(sessionDir);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          await fs.unlink(path.join(sessionDir, file));
        }
      }
    } catch (error) {
      // 忽略清理错误
    }
  });

  it('should create session on first launch', async () => {
    const session = await sessionService.create('Test session');

    expect(session).toBeDefined();
    expect(session.id).toMatch(/^session-/);
    expect(session.messages).toEqual([]);
  });

  it('should save and load messages', async () => {
    // 创建会话
    const session = await sessionService.create('Test session');

    // 添加消息
    await sessionService.addMessage({
      role: 'user',
      content: 'Hello',
    });

    await sessionService.addMessage({
      role: 'assistant',
      content: 'Hi there!',
    });

    // 加载会话
    const loadedSession = await sessionService.load(session.id);

    expect(loadedSession.messages).toHaveLength(2);
    expect(loadedSession.messages[0].content).toBe('Hello');
    expect(loadedSession.messages[1].content).toBe('Hi there!');
  });

  it('should list sessions', async () => {
    // 创建多个会话
    await sessionService.create('Session 1');
    await sessionService.create('Session 2');

    // 列出会话
    const sessions = sessionService.list();

    expect(sessions).toHaveLength(2);
    // 会话按修改时间倒序排列，最新的在前面
    expect(sessions[0].summary).toBe('Session 2');
    expect(sessions[1].summary).toBe('Session 1');
  });
});
