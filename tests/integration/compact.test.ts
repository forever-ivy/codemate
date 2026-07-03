import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '../../src/application/Application';
import { CompactCommand } from '../../src/commands/session/CompactCommand';
import type { SessionService } from '../../src/services/SessionService';
import type { ModelService } from '../../src/services/ModelService';
import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import * as os from 'node:os';

describe('CompactCommand Integration', () => {
  let app: Application;
  let command: CompactCommand;
  let testDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), `aicli-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // 设置环境变量
    process.env.AICLI_DATA_DIR = testDir;

    // 创建应用实例
    app = new Application({
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-20241022',
    });

    await app.start();

    command = new CompactCommand();
  });

  afterEach(async () => {
    await app.stop();
    // 清理测试目录
    await fs.rm(testDir, { recursive: true, force: true });
    delete process.env.AICLI_DATA_DIR;
  });

  it('should handle empty session gracefully', async () => {
    const sessionService = app.getContainer().get<SessionService>('session');
    await sessionService.create();

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await command.execute([], app);

    expect(consoleSpy).toHaveBeenCalledWith('⚠️  No messages to compact');

    consoleSpy.mockRestore();
  });

  it('should compact session with messages', async () => {
    const sessionService = app.getContainer().get<SessionService>('session');
    const modelService = app.getContainer().get<ModelService>('model');

    // 创建会话并添加消息
    await sessionService.create();
    await sessionService.addMessage({ role: 'user', content: 'Hello' });
    await sessionService.addMessage({ role: 'assistant', content: 'Hi there!' });
    await sessionService.addMessage({ role: 'user', content: 'How are you?' });
    await sessionService.addMessage({
      role: 'assistant',
      content: 'I am doing well, thank you!',
    });

    // Mock model response
    vi.spyOn(modelService, 'chatWithMessages').mockResolvedValue({
      role: 'assistant',
      content: 'Summary: User greeted and asked about wellbeing.',
    });

    const initialMessageCount = sessionService.getMessages().length;
    expect(initialMessageCount).toBe(4);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await command.execute([], app);

    const finalMessageCount = sessionService.getMessages().length;
    expect(finalMessageCount).toBe(1);
    expect(sessionService.getMessages()[0].role).toBe('user');
    expect(sessionService.getMessages()[0].content).toContain('Previous conversation summary');

    expect(consoleSpy).toHaveBeenCalledWith('✅ Session history compacted successfully');

    consoleSpy.mockRestore();
  });
});
