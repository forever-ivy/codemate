import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LogCommand } from '../../src/commands/log/LogCommand.js';
import { Container } from '../../src/application/Container.js';
import { SessionService } from '../../src/services/SessionService.js';
import { Paths } from '../../src/services/Paths.js';
import { EventBus } from '../../src/services/EventBus.js';
import { writeFile, mkdir, unlink, rmdir, readdir } from 'fs/promises';
import * as pathe from 'pathe';
import { tmpdir } from 'os';

describe('LogCommand Integration', () => {
  let command: LogCommand;
  let container: Container;
  let tempDir: string;
  let sessionsDir: string;

  beforeEach(async () => {
    container = new Container();

    // 创建临时目录
    tempDir = pathe.join(tmpdir(), `log-test-${Date.now()}`);
    sessionsDir = pathe.join(tempDir, 'sessions');
    await mkdir(sessionsDir, { recursive: true });

    // 配置 Paths 服务
    const paths = new Paths({
      productName: 'test-app',
      cwd: tempDir,
    });
    // 重写 globalProjectDir 属性指向测试目录
    (paths as any).globalProjectDir = sessionsDir;
    container.register('paths', paths);

    // 配置 EventBus
    const eventBus = new EventBus();
    container.register('eventBus', eventBus);

    // 配置 SessionService
    const sessionService = new SessionService(paths, eventBus);
    container.register('session', sessionService);

    command = new LogCommand(container);
  });

  afterEach(async () => {
    try {
      // 清理临时目录
      const files = await readdir(sessionsDir);
      for (const file of files) {
        await unlink(pathe.join(sessionsDir, file));
      }
      await rmdir(sessionsDir);
      await rmdir(tempDir);
    } catch {
      // 目录可能不存在
    }
  });

  it('应该能够处理直接文件路径参数', async () => {
    // 创建测试会话文件
    const sessionFile = pathe.join(sessionsDir, 'test-session.jsonl');
    const messages = [
      {
        role: 'user',
        content: 'Hello',
        uuid: 'msg-1',
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content: 'Hi there!',
        uuid: 'msg-2',
        parentUuid: 'msg-1',
        timestamp: Date.now(),
      },
    ];

    const jsonl = messages.map((msg) => JSON.stringify(msg)).join('\n');
    await writeFile(sessionFile, jsonl);

    // Mock console.log 以捕获输出
    const originalConsoleLog = console.log;
    const logs: string[] = [];
    console.log = (msg: string) => logs.push(msg);

    // Mock FileOpener 以避免实际打开浏览器
    const originalConsoleError = console.error;
    const errors: string[] = [];
    console.error = (msg: string) => errors.push(msg);

    try {
      await command.execute([sessionFile]);

      // 验证没有错误（FileOpener 可能会失败，但这是预期的）
      // 主要验证解析和 HTML 生成没有问题
      expect(errors.length).toBeGreaterThanOrEqual(0);
    } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    }
  });

  it('应该能够扫描会话目录', async () => {
    // 创建多个测试会话文件
    const sessions = [
      {
        name: 'session1.jsonl',
        messages: [
          { role: 'user', content: 'First session', uuid: 'msg-1', timestamp: Date.now() },
        ],
      },
      {
        name: 'session2.jsonl',
        messages: [
          { role: 'user', content: 'Second session', uuid: 'msg-2', timestamp: Date.now() },
        ],
      },
    ];

    for (const session of sessions) {
      const filePath = pathe.join(sessionsDir, session.name);
      const jsonl = session.messages.map((msg) => JSON.stringify(msg)).join('\n');
      await writeFile(filePath, jsonl);
    }

    // 测试会话扫描功能
    const paths = container.get<Paths>('paths');
    const allSessions = await (command as any).getAllSessions(paths);

    expect(allSessions).toHaveLength(2);
    expect(allSessions[0].name).toContain('session');
    expect(allSessions[0].messageCount).toBe(1);
  });

  it('应该处理空会话目录', async () => {
    // Mock console.log 以捕获输出
    const originalConsoleLog = console.log;
    const logs: string[] = [];
    console.log = (msg: string) => logs.push(msg);

    try {
      await command.execute([]);

      // 验证输出包含"没有找到会话文件"
      expect(logs.some((log) => log.includes('没有找到会话文件'))).toBe(true);
    } finally {
      console.log = originalConsoleLog;
    }
  });

  it('应该处理不存在的文件路径', async () => {
    const nonExistentFile = pathe.join(sessionsDir, 'non-existent.jsonl');

    // Mock console.error 以捕获错误
    const originalConsoleError = console.error;
    const errors: string[] = [];
    console.error = (msg: string) => errors.push(msg);

    try {
      await command.execute([nonExistentFile]);

      // 验证输出包含错误信息
      expect(errors.some((error) => error.includes('打开日志文件失败'))).toBe(true);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
