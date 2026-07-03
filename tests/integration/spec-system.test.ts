import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpecSystemManager } from '../../src/spec/system/SpecSystemManager.js';
import { EventBus } from '../../src/services/EventBus.js';
import type { CreateProjectOptions } from '../../src/spec/system/types.js';

describe('Spec System Integration', () => {
  let systemManager: SpecSystemManager;
  let eventBus: EventBus;
  let mockModelService: any;
  let mockPaths: any;

  beforeEach(async () => {
    eventBus = new EventBus();
    mockModelService = {
      chat: vi.fn().mockResolvedValue('Mock AI response'),
    };
    mockPaths = {
      getDataDir: vi.fn().mockReturnValue('/tmp/test-data'),
      getConfigDir: vi.fn().mockReturnValue('/tmp/test-config'),
    };

    systemManager = new SpecSystemManager(eventBus, mockModelService, mockPaths);
    await systemManager.initialize();
  });

  afterEach(async () => {
    await systemManager.shutdown();
  });

  it('应该成功初始化系统', async () => {
    const health = await systemManager.getSystemHealth();
    expect(health.status).toBe('healthy');
    expect(health.components.size).toBeGreaterThan(0);
  });

  it('应该能创建和管理项目', async () => {
    const options: CreateProjectOptions = {
      name: '测试项目',
      description: '集成测试项目',
      path: '/tmp/test-project',
      type: 'web',
      techStack: ['TypeScript', 'React'],
      teamSize: 'small',
      complexity: 'medium',
      initOptions: {
        autoStartBrainstorm: false,
        useDefaultTemplate: true,
        enableCache: true,
        enableMonitoring: true,
        notifications: {
          enabled: true,
          channels: ['console'],
          level: 'info',
          templates: new Map(),
        },
      },
    };

    const project = await systemManager.createProject(options);
    expect(project.name).toBe('测试项目');
    expect(project.status).toBe('initializing');

    const retrievedProject = await systemManager.getProject(project.id);
    expect(retrievedProject?.id).toBe(project.id);
  });

  it('应该能执行工作流', async () => {
    const workflows = systemManager.getAvailableWorkflows();
    expect(workflows.length).toBeGreaterThan(0);
    expect(workflows.some((w) => w.id === 'complete-project')).toBe(true);
  });

  it('应该能优化系统性能', async () => {
    const results = await systemManager.optimizePerformance();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });
});
