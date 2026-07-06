import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanManager } from '../../../src/spec/plan/PlanManager.js';
import { EventBus } from '../../../src/services/EventBus.js';
import type {
  ImplementationPlan,
  CreatePlanRequest,
  UpdatePlanRequest,
} from '../../../src/spec/plan/types.js';
import type { SpecDocument } from '../../../src/spec/types.js';

// Mock PlanStorage
const mockPlanStorage = {
  initialize: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  findBySpecId: vi.fn(),
  update: vi.fn(),
  exists: vi.fn(),
  getStats: vi.fn(),
  exportToMarkdown: vi.fn(),
};

// Mock SpecManager
const mockSpecManager = {
  get: vi.fn(),
};

// Mock ModelService
const mockModelService = {
  chat: vi.fn(),
};

describe('PlanManager', () => {
  let planManager: PlanManager;
  let eventBus: EventBus;
  let mockSpec: SpecDocument;
  let mockPlan: ImplementationPlan;

  beforeEach(() => {
    eventBus = new EventBus();
    planManager = new PlanManager(
      mockPlanStorage as any,
      mockSpecManager as any,
      eventBus,
      mockModelService as any
    );
    vi.clearAllMocks();

    mockSpec = {
      id: 'spec-123',
      title: '用户认证系统',
      description: '实现用户注册、登录功能',
      content: '## 功能需求\n- 用户注册\n- 用户登录',
      tags: ['auth', 'user'],
      projectPath: '/test/project',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPlan = {
      id: 'plan-123',
      specId: 'spec-123',
      name: '用户认证系统 - 实施计划',
      description: '详细的实施计划',
      phases: [
        {
          id: 'phase-1',
          name: '项目初始化',
          description: '搭建基础架构',
          tasks: [
            {
              id: 'task-1-1',
              name: '项目结构搭建',
              description: '创建项目目录',
              type: 'setup',
              priority: 'high',
              status: 'pending',
              estimate: { min: 1, max: 2, expected: 1.5, unit: 'days' },
              dependencies: [],
              prerequisites: [],
              acceptanceCriteria: ['项目结构完整'],
              technicalRequirements: ['Node.js'],
              risks: ['环境问题'],
              tags: ['setup'],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          estimate: { min: 1, max: 2, expected: 1.5, unit: 'days' },
          prerequisites: [],
          objectives: ['建立基础'],
          deliverables: ['项目骨架'],
          milestones: ['环境就绪'],
        },
      ],
      totalEstimate: { min: 10, max: 20, expected: 15, unit: 'days' },
      dependencies: [],
      risks: [],
      resources: [],
      criticalPath: [],
      projectPath: '/test/project',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('初始化', () => {
    it('应该能初始化计划管理器', async () => {
      await planManager.initialize();
      expect(mockPlanStorage.initialize).toHaveBeenCalled();
    });
  });

  describe('创建计划', () => {
    it('应该能创建实施计划', async () => {
      const request: CreatePlanRequest = {
        specId: 'spec-123',
        options: {
          detailLevel: 'detailed',
          includeRiskAssessment: true,
          includeResourceAllocation: true,
          includeTimeEstimation: true,
          teamSize: 'medium',
          complexity: 'medium',
        },
        projectPath: '/test/project',
      };

      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanStorage.save.mockResolvedValue(undefined);

      const eventSpy = vi.fn();
      eventBus.on('plan_event', eventSpy);

      const plan = await planManager.create(request);

      expect(plan).toBeDefined();
      expect(plan.specId).toBe(request.specId);
      expect(mockSpecManager.get).toHaveBeenCalledWith(request.specId);
      expect(mockPlanStorage.save).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plan_created',
        })
      );
    });

    it('应该在规格文档不存在时抛出错误', async () => {
      const request: CreatePlanRequest = {
        specId: 'nonexistent-spec',
        options: {
          detailLevel: 'basic',
          includeRiskAssessment: false,
          includeResourceAllocation: false,
          includeTimeEstimation: true,
          teamSize: 'small',
          complexity: 'low',
        },
        projectPath: '/test/project',
      };

      mockSpecManager.get.mockResolvedValue(null);

      await expect(planManager.create(request)).rejects.toThrow('规格文档不存在');
    });

    it('应该应用用户自定义信息', async () => {
      const request: CreatePlanRequest = {
        specId: 'spec-123',
        name: '自定义计划名称',
        description: '自定义计划描述',
        options: {
          detailLevel: 'basic',
          includeRiskAssessment: false,
          includeResourceAllocation: false,
          includeTimeEstimation: true,
          teamSize: 'small',
          complexity: 'low',
        },
        projectPath: '/test/project',
      };

      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanStorage.save.mockResolvedValue(undefined);

      const plan = await planManager.create(request);

      expect(plan.name).toBe(request.name);
      expect(plan.description).toBe(request.description);
    });
  });

  describe('获取计划', () => {
    it('应该能获取实施计划', async () => {
      mockPlanStorage.load.mockResolvedValue(mockPlan);

      const plan = await planManager.get('plan-123');

      expect(plan).toEqual(mockPlan);
      expect(mockPlanStorage.load).toHaveBeenCalledWith('plan-123');
    });

    it('应该在计划不存在时返回null', async () => {
      mockPlanStorage.load.mockResolvedValue(null);

      const plan = await planManager.get('nonexistent-plan');

      expect(plan).toBeNull();
    });
  });

  describe('更新计划', () => {
    it('应该能更新实施计划', async () => {
      const request: UpdatePlanRequest = {
        id: 'plan-123',
        updates: {
          name: '更新后的计划名称',
          description: '更新后的描述',
        },
      };

      const updatedPlan = { ...mockPlan, ...request.updates };
      mockPlanStorage.update.mockResolvedValue(updatedPlan);

      const eventSpy = vi.fn();
      eventBus.on('plan_event', eventSpy);

      const result = await planManager.update(request);

      expect(result).toEqual(updatedPlan);
      expect(mockPlanStorage.update).toHaveBeenCalledWith(request.id, request.updates);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plan_updated',
        })
      );
    });
  });

  describe('删除计划', () => {
    it('应该能删除实施计划', async () => {
      mockPlanStorage.load.mockResolvedValue(mockPlan);
      mockPlanStorage.delete.mockResolvedValue(true);

      const eventSpy = vi.fn();
      eventBus.on('plan_event', eventSpy);

      const result = await planManager.delete('plan-123');

      expect(result).toBe(true);
      expect(mockPlanStorage.delete).toHaveBeenCalledWith('plan-123');
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plan_deleted',
        })
      );
    });
  });

  describe('任务状态更新', () => {
    it('应该能更新任务状态', async () => {
      mockPlanStorage.load.mockResolvedValue(mockPlan);

      const updatedPlan = { ...mockPlan };
      updatedPlan.phases[0].tasks[0].status = 'completed';
      mockPlanStorage.update.mockResolvedValue(updatedPlan);

      const eventSpy = vi.fn();
      eventBus.on('plan_event', eventSpy);

      const result = await planManager.updateTaskStatus('plan-123', 'task-1-1', 'completed');

      expect(result).toBeDefined();
      expect(result?.phases[0].tasks[0].status).toBe('completed');
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_status_updated',
        })
      );
    });

    it('应该在任务不存在时抛出错误', async () => {
      mockPlanStorage.load.mockResolvedValue(mockPlan);

      await expect(
        planManager.updateTaskStatus('plan-123', 'nonexistent-task', 'completed')
      ).rejects.toThrow('任务不存在');
    });
  });

  describe('计划进度', () => {
    it('应该能计算计划进度', () => {
      const progress = planManager.getProgress(mockPlan);

      expect(progress).toBeDefined();
      expect(progress.totalTasks).toBe(1);
      expect(progress.pendingTasks).toBe(1);
      expect(progress.completedTasks).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('应该能计算完成进度', () => {
      const completedPlan = { ...mockPlan };
      completedPlan.phases[0].tasks[0].status = 'completed';

      const progress = planManager.getProgress(completedPlan);

      expect(progress.completedTasks).toBe(1);
      expect(progress.percentage).toBe(100);
    });
  });

  describe('计划复制', () => {
    it('应该能复制计划', async () => {
      mockPlanStorage.load.mockResolvedValue(mockPlan);
      mockPlanStorage.save.mockResolvedValue(undefined);

      const eventSpy = vi.fn();
      eventBus.on('plan_event', eventSpy);

      const duplicatedPlan = await planManager.duplicate('plan-123', '复制的计划');

      expect(duplicatedPlan).toBeDefined();
      expect(duplicatedPlan?.name).toBe('复制的计划');
      expect(duplicatedPlan?.id).not.toBe(mockPlan.id);
      expect(duplicatedPlan?.phases[0].tasks[0].status).toBe('pending');
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plan_duplicated',
        })
      );
    });
  });

  describe('计划验证', () => {
    it('应该能验证有效计划', async () => {
      mockPlanStorage.load.mockResolvedValue(mockPlan);

      const validation = await planManager.validatePlan('plan-123');

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该能检测无效计划', async () => {
      const invalidPlan = { ...mockPlan };
      invalidPlan.name = ''; // 空名称
      invalidPlan.phases = []; // 没有阶段

      mockPlanStorage.load.mockResolvedValue(invalidPlan);

      const validation = await planManager.validatePlan('plan-123');

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('计划名称不能为空');
      expect(validation.errors).toContain('计划必须包含至少一个阶段');
    });
  });

  describe('统计信息', () => {
    it('应该能获取计划统计信息', async () => {
      mockPlanStorage.getStats.mockResolvedValue({
        totalPlans: 5,
        plansBySpec: { 'spec-123': 2, 'spec-456': 3 },
        recentPlans: [mockPlan],
      });

      mockPlanStorage.list.mockResolvedValue([mockPlan]);

      const stats = await planManager.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalPlans).toBe(5);
      expect(stats.taskStats.total).toBe(1);
      expect(stats.taskStats.pending).toBe(1);
    });
  });
});
