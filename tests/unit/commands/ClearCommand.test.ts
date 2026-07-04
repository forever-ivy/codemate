import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from '../../../src/application/Container';
import { Paths } from '../../../src/services/Paths';
import { EventBus } from '../../../src/services/EventBus';
import { SessionService } from '../../../src/services/SessionService';
import { ClearCommand } from '../../../src/commands/session/ClearCommand';

describe('ClearCommand', () => {
  let container: Container;
  let sessionService: SessionService;
  let clearCommand: ClearCommand;
  let mockApp: any;

  beforeEach(async () => {
    // 创建容器和服务
    container = new Container();

    const eventBus = new EventBus();
    const paths = new Paths({
      productName: 'aicli-test',
      cwd: process.cwd(),
    });
    sessionService = new SessionService(paths, eventBus);

    // 注册服务
    container.register('eventBus', eventBus);
    container.register('paths', paths);
    container.register('session', sessionService);

    // 初始化SessionService
    await sessionService.initialize();

    // 创建模拟的Application对象
    mockApp = {
      getContainer: () => container,
    };

    // 创建命令实例
    clearCommand = new ClearCommand();
  });

  describe('基本功能', () => {
    it('应该有正确的命令名称和描述', () => {
      expect(clearCommand.name).toBe('clear');
      expect(clearCommand.description).toBe('Start a new session');
      expect(clearCommand.aliases).toEqual(['c']);
    });

    it('应该清除消息并创建新会话', async () => {
      // 创建会话并添加消息
      await sessionService.create();
      await sessionService.addMessage({
        role: 'user',
        content: 'Test message',
      });

      const beforeClear = sessionService.getCurrent();
      expect(beforeClear?.messages.length).toBe(1);

      // 执行clear命令
      await clearCommand.execute([], mockApp);

      // 验证结果
      const afterClear = sessionService.getCurrent();
      expect(afterClear?.messages.length).toBe(0);
      expect(afterClear?.id).not.toBe(beforeClear?.id);
    });

    it('应该返回正确的会话ID格式', async () => {
      // 创建会话
      await sessionService.create();

      // 捕获console.log输出
      const consoleLogs: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => {
        // 只捕获clear命令的输出
        if (message.startsWith('Messages cleared, new session id:')) {
          consoleLogs.push(message);
        }
      };

      try {
        // 执行clear命令
        await clearCommand.execute([], mockApp);

        // 验证输出格式
        expect(consoleLogs.length).toBe(1);
        expect(consoleLogs[0]).toMatch(/^Messages cleared, new session id: session-\d+$/);
      } finally {
        // 恢复console.log
        console.log = originalLog;
      }
    });
  });

  describe('错误处理', () => {
    it('应该处理SessionService错误', async () => {
      // 创建一个会抛出错误的模拟SessionService
      const errorContainer = new Container();
      const mockSessionService = {
        clear: async () => {
          throw new Error('Test error');
        },
      };
      errorContainer.register('session', mockSessionService);

      const errorApp = {
        getContainer: () => errorContainer,
      };

      // 捕获console输出
      const consoleLogs: string[] = [];
      const consoleErrors: any[] = [];
      const originalLog = console.log;
      const originalError = console.error;

      console.log = (message: string) => {
        consoleLogs.push(message);
      };
      console.error = (error: any) => {
        consoleErrors.push(error);
      };

      try {
        // 执行clear命令
        await clearCommand.execute([], errorApp);

        // 验证错误处理
        expect(consoleLogs).toContain('❌ Failed to clear messages');
        expect(consoleErrors.length).toBe(1);
      } finally {
        // 恢复console
        console.log = originalLog;
        console.error = originalError;
      }
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成', async () => {
      // 创建会话
      await sessionService.create();

      // 测量执行时间
      const startTime = Date.now();
      await clearCommand.execute([], mockApp);
      const endTime = Date.now();

      // 保留性能回归上限，同时容忍 CI 并行调度的短暂抖动。
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});
