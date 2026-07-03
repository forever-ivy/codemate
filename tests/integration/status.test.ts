import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '../../src/application/Application.js';
import { ConfigService } from '../../src/services/ConfigService.js';
import { ConfigManager } from '../../src/config/ConfigManager.js';
import { StatusDataCollector } from '../../src/services/StatusDataCollector.js';
import { StatusCommand } from '../../src/commands/system/StatusCommand.js';
import type { ModelConfig } from '../../src/types/index.js';
import type { SlashCommandManager } from '../../src/managers/SlashCommandManager.js';
import type { EventBus } from '../../src/services/EventBus.js';

describe('Status Integration Tests', () => {
  let app: Application;
  let configService: ConfigService;
  let configManager: ConfigManager;

  beforeEach(async () => {
    // 创建测试配置
    const modelConfig: ModelConfig = {
      model: 'deepseek-chat',
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com',
    };

    configManager = new ConfigManager({
      cwd: process.cwd(),
      productName: 'aicli-test',
    });

    configService = new ConfigService(configManager);
    app = new Application(modelConfig, configService, configManager);

    await app.start();
  });

  afterEach(async () => {
    await app.stop();
  });

  describe('应用集成', () => {
    it('应该正确注册StatusDataCollector服务', () => {
      const container = app.getContainer();
      const statusCollector = container.get<StatusDataCollector>('statusCollector');

      expect(statusCollector).toBeInstanceOf(StatusDataCollector);
    });

    it('应该正确注册Status命令', () => {
      const container = app.getContainer();
      const commandManager = container.get<SlashCommandManager>('command');

      const commands = commandManager.list();
      expect(commands).toContain('status');

      const statusCommand = commandManager.get('status');
      expect(statusCommand).toBeInstanceOf(StatusCommand);
      expect(statusCommand.name).toBe('status');
    });

    it('应该正确设置事件总线', () => {
      const container = app.getContainer();
      const eventBus = container.get<EventBus>('eventBus');

      expect(eventBus).toBeDefined();
      expect(typeof eventBus.emit).toBe('function');
      expect(typeof eventBus.on).toBe('function');
      expect(typeof eventBus.off).toBe('function');
    });
  });

  describe('StatusDataCollector集成', () => {
    it('应该能够收集完整的系统状态', async () => {
      const container = app.getContainer();
      const statusCollector = container.get<StatusDataCollector>('statusCollector');

      const status = await statusCollector.collectAllStatus();

      expect(status).toMatchObject({
        system: {
          platform: expect.any(String),
          nodeVersion: expect.any(String),
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number),
          },
          cpu: {
            usage: expect.any(Number),
            cores: expect.any(Number),
          },
          uptime: expect.any(Number),
          loadAverage: expect.any(Array),
        },
        sessions: {
          total: expect.any(Number),
          active: expect.any(Number),
          totalMessages: expect.any(Number),
          storageUsed: expect.any(String),
          averageSessionLength: expect.any(Number),
          recentSessions: expect.any(Number),
        },
        models: {
          currentModel: expect.any(String),
          totalRequests: expect.any(Number),
          totalTokens: expect.any(Object),
          estimatedCost: expect.any(Number),
          averageResponseTime: expect.any(Number),
          errorRate: expect.any(Number),
          popularModels: expect.any(Array),
        },
        components: {
          configService: expect.stringMatching(/^(healthy|warning|error)$/),
          mcpServers: expect.stringMatching(/^(healthy|warning|error)$/),
          eventBus: expect.stringMatching(/^(healthy|warning|error)$/),
          sessionService: expect.stringMatching(/^(healthy|warning|error)$/),
          toolManager: expect.stringMatching(/^(healthy|warning|error)$/),
          overall: expect.stringMatching(/^(healthy|warning|error)$/),
        },
        performance: {
          responseTime: expect.any(Object),
          throughput: expect.any(Object),
          errorRates: expect.any(Object),
          resourceUsage: expect.any(Object),
        },
        timestamp: expect.any(Date),
      });
    });

    it('应该能够单独收集各种状态信息', async () => {
      const container = app.getContainer();
      const statusCollector = container.get<StatusDataCollector>('statusCollector');

      // 测试系统信息收集
      const systemInfo = await statusCollector.collectSystemInfo();
      expect(systemInfo.platform).toContain(process.platform);
      expect(systemInfo.nodeVersion).toBe(process.version);

      // 测试会话统计收集
      const sessionStats = await statusCollector.collectSessionStats();
      expect(sessionStats.total).toBeGreaterThanOrEqual(0);

      // 测试模型统计收集
      const modelStats = await statusCollector.collectModelStats();
      expect(modelStats.currentModel).toBeDefined();

      // 测试组件健康检查
      const componentHealth = await statusCollector.checkComponentHealth();
      expect(['healthy', 'warning', 'error']).toContain(componentHealth.overall);

      // 测试性能指标收集
      const performanceMetrics = await statusCollector.collectPerformanceMetrics();
      expect(performanceMetrics.responseTime).toBeDefined();
    });

    it('应该能够记录和计算性能指标', async () => {
      const container = app.getContainer();
      const statusCollector = container.get<StatusDataCollector>('statusCollector');

      // 记录一些响应时间
      statusCollector.recordResponseTime(100);
      statusCollector.recordResponseTime(200);
      statusCollector.recordResponseTime(150);

      const metrics = await statusCollector.collectPerformanceMetrics();
      expect(metrics.responseTime.average).toBeCloseTo(150, 1);
    });
  });

  describe('Status命令集成', () => {
    it('应该能够执行Status命令', async () => {
      const container = app.getContainer();
      const commandManager = container.get<SlashCommandManager>('command');
      const eventBus = container.get<EventBus>('eventBus');

      const statusCommand = commandManager.get('status') as StatusCommand;

      // 监听事件
      let eventEmitted = false;
      const eventHandler = () => {
        eventEmitted = true;
      };

      eventBus.on('show_status_manager', eventHandler);

      // 执行命令
      await statusCommand.execute([], app);

      // 验证事件被触发
      expect(eventEmitted).toBe(true);

      // 清理
      eventBus.off('show_status_manager', eventHandler);
    });

    it('应该能够获取状态数据', async () => {
      const container = app.getContainer();
      const commandManager = container.get<SlashCommandManager>('command');

      const statusCommand = commandManager.get('status') as StatusCommand;

      const data = await statusCommand.fetchData();
      expect(data).toBeDefined();
      expect(data.timestamp).toBeInstanceOf(Date);
    });

    it('应该提供正确的UI组件', () => {
      const container = app.getContainer();
      const commandManager = container.get<SlashCommandManager>('command');

      const statusCommand = commandManager.get('status') as StatusCommand;

      const component = statusCommand.getUIComponent();
      expect(component).toBeDefined();
    });

    it('应该提供键盘快捷键', () => {
      const container = app.getContainer();
      const commandManager = container.get<SlashCommandManager>('command');

      const statusCommand = commandManager.get('status') as StatusCommand;

      const shortcuts = statusCommand.getKeyboardShortcuts();
      expect(shortcuts).toBeInstanceOf(Array);
      expect(shortcuts.length).toBeGreaterThan(0);

      // 验证必要的快捷键
      const shortcutKeys = shortcuts.map((s) => s.key);
      expect(shortcutKeys).toContain('r'); // refresh
      expect(shortcutKeys).toContain('q'); // quit
    });

    it('应该提供正确的元数据', () => {
      const container = app.getContainer();
      const commandManager = container.get<SlashCommandManager>('command');

      const statusCommand = commandManager.get('status') as StatusCommand;

      const metadata = statusCommand.getMetadata();
      expect(metadata).toMatchObject({
        title: 'System Status',
        description: expect.any(String),
        category: 'System',
        icon: '📊',
        color: 'blue',
        priority: 1,
      });
    });
  });

  describe('错误处理', () => {
    it('应该优雅处理数据收集错误', async () => {
      const container = app.getContainer();
      const statusCollector = container.get<StatusDataCollector>('statusCollector');

      // 即使某些数据收集失败，也应该返回部分数据
      const status = await statusCollector.collectAllStatus();
      expect(status).toBeDefined();
      expect(status.timestamp).toBeInstanceOf(Date);
    });

    it('应该优雅处理命令执行错误', async () => {
      const container = app.getContainer();
      const commandManager = container.get<SlashCommandManager>('command');

      const statusCommand = commandManager.get('status') as StatusCommand;

      // 命令执行不应该抛出异常
      await expect(statusCommand.execute([], app)).resolves.not.toThrow();
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成状态收集', async () => {
      const container = app.getContainer();
      const statusCollector = container.get<StatusDataCollector>('statusCollector');

      const startTime = Date.now();
      await statusCollector.collectAllStatus();
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
    });

    it('应该能够处理多次并发状态收集', async () => {
      const container = app.getContainer();
      const statusCollector = container.get<StatusDataCollector>('statusCollector');

      // 并发执行多次状态收集
      const promises = Array(5)
        .fill(null)
        .map(() => statusCollector.collectAllStatus());

      const results = await Promise.all(promises);

      // 所有结果都应该成功
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.timestamp).toBeInstanceOf(Date);
      });
    });
  });
});
