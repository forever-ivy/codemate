import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionService } from '../../src/services/SessionService';
import { EventBus } from '../../src/services/EventBus';
import { Paths } from '../../src/services/Paths';
import type { EnhancedMessage } from '../../src/types/index';
import * as fs from 'node:fs';
import * as path from 'pathe';

describe('Session Fork Integration', () => {
  let sessionService: SessionService;
  let eventBus: EventBus;
  let paths: Paths;
  const testDir = path.join(process.cwd(), 'test-sessions');

  beforeEach(async () => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    eventBus = new EventBus();
    paths = new Paths({
      productName: 'test-codemate',
      cwd: testDir,
    });
    sessionService = new SessionService(paths, eventBus);
    await sessionService.initialize();
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * 测试 1：应该能创建会话分支
   */
  it('should fork session successfully', async () => {
    // 创建会话
    const session = await sessionService.create('Test session');

    // 添加消息
    await sessionService.addEnhancedMessage({
      role: 'user',
      content: 'Message 1',
      parentUuid: null,
    });

    const messages = session.messages as EnhancedMessage[];
    await sessionService.addEnhancedMessage({
      role: 'assistant',
      content: 'Message 2',
      parentUuid: messages[0].uuid,
    });

    // 分叉
    const forkedSession = await sessionService.fork({
      fromMessageUuid: messages[0].uuid,
    });

    expect(forkedSession.id).not.toBe(session.id);
    expect(forkedSession.messages).toHaveLength(1);
  });

  /**
   * 测试 2：分叉应该保留正确的消息
   */
  it('should preserve correct messages in fork', async () => {
    const session = await sessionService.create('Test session');

    // 创建分支结构
    await sessionService.addEnhancedMessage({
      role: 'user',
      content: 'Root',
      parentUuid: null,
    });

    const messages = session.messages as EnhancedMessage[];
    await sessionService.addEnhancedMessage({
      role: 'assistant',
      content: 'Branch A',
      parentUuid: messages[0].uuid,
    });

    // 分叉到第一条消息
    const forkedSession = await sessionService.fork({
      fromMessageUuid: messages[0].uuid,
    });

    const forkedMessages = forkedSession.messages as EnhancedMessage[];
    expect(forkedMessages).toHaveLength(1);
    expect(forkedMessages[0].content).toBe('Root');
  });
});
