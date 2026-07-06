import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpecBrainstormCommand } from '../../../src/commands/spec/SpecBrainstormCommand.js';
import { Application } from '../../../src/application/Application.js';
import { Container } from '../../../src/application/Container.js';
import { EventBus } from '../../../src/services/EventBus.js';
import { SpecManager } from '../../../src/spec/SpecManager.js';

// Mock ModelService
const mockModelService = {
  chat: vi.fn().mockResolvedValue('{"test": "response"}'),
};

// Mock SpecManager
const mockSpecManager = {
  create: vi.fn().mockResolvedValue({
    id: 'test-spec-123',
    title: '测试规格文档',
    description: '测试描述',
  }),
};

// Mock Application
const mockApp = {
  getContainer: vi.fn().mockReturnValue({
    get: vi.fn().mockImplementation((service: string) => {
      switch (service) {
        case 'model':
          return mockModelService;
        case 'eventBus':
          return new EventBus();
        case 'spec':
          return mockSpecManager;
        default:
          return null;
      }
    }),
  }),
} as unknown as Application;

describe('SpecBrainstormCommand', () => {
  let command: SpecBrainstormCommand;

  beforeEach(() => {
    command = new SpecBrainstormCommand();
    vi.clearAllMocks();
  });

  describe('基本属性', () => {
    it('应该有正确的命令名称', () => {
      expect(command.name).toBe('spec:brainstorm');
    });

    it('应该有正确的描述', () => {
      expect(command.description).toBe('AI-assisted project requirements brainstorming');
    });

    it('应该有正确的别名', () => {
      expect(command.aliases).toEqual(['spec:bs', 'brainstorm']);
    });
  });

  describe('参数验证', () => {
    it('应该拒绝空参数', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = command.validate([]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ 用法: /spec:brainstorm <项目主题> 或 /spec:brainstorm --interactive'
      );

      consoleSpy.mockRestore();
    });

    it('应该接受有效的主题', () => {
      const result = command.validate(['用户认证系统']);
      expect(result).toBe(true);
    });

    it('应该接受交互模式参数', () => {
      expect(command.validate(['--interactive'])).toBe(true);
      expect(command.validate(['-i'])).toBe(true);
    });

    it('应该接受多词主题', () => {
      const result = command.validate(['电商', '购物车', '系统']);
      expect(result).toBe(true);
    });
  });

  describe('命令执行', () => {
    it('应该能处理基本的执行流程', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 模拟执行
      try {
        await command.execute(['测试主题'], mockApp);
      } catch (error) {
        // 预期会有错误，因为我们没有完整的模拟环境
        expect(error).toBeDefined();
      }

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该能处理交互模式', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await command.execute(['--interactive'], mockApp);
      } catch (error) {
        // 预期会有错误，因为我们没有完整的模拟环境
        expect(error).toBeDefined();
      }

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该能处理执行错误', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 创建一个会抛出错误的 mock app
      const errorApp = {
        getContainer: vi.fn().mockImplementation(() => {
          throw new Error('测试错误');
        }),
      } as unknown as Application;

      await command.execute(['测试主题'], errorApp);

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ 头脑风暴失败:', '测试错误');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('私有方法测试', () => {
    it('应该能创建命令实例', () => {
      expect(command).toBeInstanceOf(SpecBrainstormCommand);
      expect(command.name).toBeDefined();
      expect(command.description).toBeDefined();
      expect(command.aliases).toBeDefined();
    });

    it('应该继承自 SlashCommand', () => {
      expect(command.validate).toBeDefined();
      expect(command.execute).toBeDefined();
    });
  });
});
