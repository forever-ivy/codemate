import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '../../src/application/Application';
import { ResumeCommand } from '../../src/commands/session/ResumeCommand';
import { SessionService } from '../../src/services/SessionService';
import { Container } from '../../src/application/Container';
import fs from 'fs/promises';
import path from 'path';

describe('Resume Integration', () => {
  let app: Application;
  let resumeCommand: ResumeCommand;
  let testDir: string;

  beforeEach(async () => {
    // 创建测试目录
    testDir = path.join(__dirname, '../temp/resume-test');
    await fs.mkdir(testDir, { recursive: true });

    // 初始化应用
    const container = new Container();
    app = new Application(container);
    resumeCommand = new ResumeCommand();

    // 创建测试会话文件
    await createTestSessions();
  });

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createTestSessions() {
    const sessionsDir = path.join(testDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });

    // 创建测试会话1
    const session1Messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    await fs.writeFile(
      path.join(sessionsDir, 'test-session-1.jsonl'),
      session1Messages.map((m) => JSON.stringify(m)).join('\n')
    );

    // 创建测试会话2
    const session2Messages = [
      { role: 'user', content: 'How are you?' },
      { role: 'assistant', content: 'I am doing well!' },
      { role: 'user', content: 'Great!' },
    ];

    await fs.writeFile(
      path.join(sessionsDir, 'test-session-2.jsonl'),
      session2Messages.map((m) => JSON.stringify(m)).join('\n')
    );
  }

  it('should list and resume sessions', async () => {
    // 执行resume命令
    const sessionService = app.getContainer().get<SessionService>('session');
    const sessions = sessionService.list();

    // 验证会话列表
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe('test-session-1');
    expect(sessions[1].sessionId).toBe('test-session-2');

    // 恢复第一个会话
    await sessionService.resume('test-session-1');

    // 验证当前会话
    const current = sessionService.getCurrent();
    expect(current?.id).toBe('test-session-1');
    expect(current?.messages).toHaveLength(2);
  });
});
