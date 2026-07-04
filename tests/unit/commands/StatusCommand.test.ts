import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCommand } from '../../../src/commands/system/StatusCommand.js';
import { StatusDataCollector } from '../../../src/services/StatusDataCollector.js';
import { EventBus } from '../../../src/services/EventBus.js';
import { Application } from '../../../src/application/Application.js';

// Mock dependencies
vi.mock('../../../src/services/StatusDataCollector.js');
vi.mock('../../../src/services/EventBus.js');
vi.mock('../../../src/application/Application.js');

describe('StatusCommand', () => {
  let statusCommand: StatusCommand;
  let mockEventBus: vi.Mocked<EventBus>;
  let mockStatusCollector: vi.Mocked<StatusDataCollector>;
  let mockApp: vi.Mocked<Application>;

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as any;

    mockStatusCollector = {
      collectAllStatus: vi.fn(),
      collectSystemInfo: vi.fn(),
      collectSessionStats: vi.fn(),
      collectModelStats: vi.fn(),
      checkComponentHealth: vi.fn(),
      collectPerformanceMetrics: vi.fn(),
      recordResponseTime: vi.fn(),
    } as any;

    mockApp = {
      getContainer: vi.fn(),
    } as any;

    statusCommand = new StatusCommand(mockEventBus, mockStatusCollector);
  });

  describe('基本属性', () => {
    it('应该有正确的命令名称', () => {
      expect(statusCommand.name).toBe('status');
    });

    it('应该有正确的描述', () => {
      expect(statusCommand.description).toBe('Show system status and statistics');
    });

    it('应该有正确的别名', () => {
      expect(statusCommand.aliases).toEqual(['stat', 'info']);
    });
  });

  describe('execute方法', () => {
    it('应该触发show_status_manager事件', async () => {
      await statusCommand.execute([], mockApp);

      expect(mockEventBus.emit).toHaveBeenCalledWith('show_status_manager', {
        statusCollector: mockStatusCollector,
      });
    });

    it('应该处理空参数数组', async () => {
      await expect(statusCommand.execute([], mockApp)).resolves.not.toThrow();
    });

    it('应该处理带参数的调用', async () => {
      await expect(statusCommand.execute(['--verbose'], mockApp)).resolves.not.toThrow();
    });
  });

  describe('fetchData方法', () => {
    it('应该调用statusCollector.collectAllStatus', async () => {
      const mockData = {
        system: { platform: 'test' },
        sessions: { total: 0 },
        models: { currentModel: 'test' },
        components: { overall: 'healthy' },
        performance: { responseTime: { average: 100 } },
        timestamp: new Date(),
      };

      mockStatusCollector.collectAllStatus.mockResolvedValue(mockData);

      const result = await statusCommand.fetchData();

      expect(mockStatusCollector.collectAllStatus).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('应该处理数据收集错误', async () => {
      mockStatusCollector.collectAllStatus.mockRejectedValue(new Error('Collection failed'));

      await expect(statusCommand.fetchData()).rejects.toThrow('Collection failed');
    });
  });

  describe('getUIComponent方法', () => {
    it('应该返回StatusManager组件', () => {
      const component = statusCommand.getUIComponent();
      expect(component).toBeDefined();
    });
  });

  describe('getKeyboardShortcuts方法', () => {
    it('应该返回正确的键盘快捷键', () => {
      const shortcuts = statusCommand.getKeyboardShortcuts();

      expect(shortcuts).toEqual([
        {
          key: 'r',
          description: 'Refresh data',
          handler: expect.any(Function),
          category: 'Actions',
        },
        {
          key: '1-5',
          description: 'Switch tabs',
          handler: expect.any(Function),
          category: 'Navigation',
        },
        {
          key: '←→',
          description: 'Navigate tabs',
          handler: expect.any(Function),
          category: 'Navigation',
        },
        {
          key: 'h',
          description: 'Toggle health details',
          handler: expect.any(Function),
          category: 'View',
        },
        {
          key: 's',
          description: 'Toggle system details',
          handler: expect.any(Function),
          category: 'View',
        },
        {
          key: 'q',
          description: 'Exit',
          handler: expect.any(Function),
          category: 'Actions',
        },
      ]);
    });
  });

  describe('getMetadata方法', () => {
    it('应该返回正确的元数据', () => {
      const metadata = statusCommand.getMetadata();

      expect(metadata).toEqual({
        title: 'System Status',
        description: 'Monitor system resources and application health',
        category: 'System',
        icon: '📊',
        color: 'blue',
        priority: 1,
      });
    });
  });

  describe('继承的方法', () => {
    it('应该正确实现applyCustomFilters', () => {
      const testData = [
        { name: 'test1', value: 1 },
        { name: 'test2', value: 2 },
      ];
      const filters = { category: 'test' };

      const result = statusCommand['applyCustomFilters'](testData, filters);
      expect(result).toEqual(testData);
    });

    it('应该正确实现getSearchableText', () => {
      expect(statusCommand['getSearchableText']('test string')).toBe('test string');
      expect(statusCommand['getSearchableText']({ name: 'test' })).toBe('test');
      expect(statusCommand['getSearchableText']({ title: 'test title' })).toBe('test title');
      expect(statusCommand['getSearchableText']({ other: 'value' })).toBe('{"other":"value"}');
    });

    it('应该正确实现getSortValue', () => {
      const item = { name: 'test', priority: 1 };

      expect(statusCommand['getSortValue'](item, 'name')).toBe('test');
      expect(statusCommand['getSortValue'](item, 'priority')).toBe(1);
      expect(statusCommand['getSortValue'](item, 'missing')).toBe('');
    });
  });
});
