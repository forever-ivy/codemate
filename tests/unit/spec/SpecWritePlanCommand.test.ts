import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpecWritePlanCommand } from '../../../src/commands/spec/SpecWritePlanCommand.js';
import type { Application } from '../../../src/application/Application.js';
import type { Container } from '../../../src/application/Container.js';
import type { SpecManager } from '../../../src/spec/SpecManager.js';
import type { PlanManager } from '../../../src/spec/plan/PlanManager.js';
import type { EventBus } from '../../../src/services/EventBus.js';
import type { SpecDocument } from '../../../src/spec/types.js';
import type { ImplementationPlan } from '../../../src/spec/plan/types.js';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('SpecWritePlanCommand', () => {
  let command: SpecWritePlanCommand;
  let mockApp: Application;
  let mockContainer: Container;
  let mockSpecManager: SpecManager;
  let mockPlanManager: PlanManager;
  let mockEventBus: EventBus;
  let mockSpec: SpecDocument;
  let mockPlan: ImplementationPlan;
  let consoleOutput: string[];

  beforeEach(() => {
    // Mock console output
    consoleOutput = [];
    console.log = vi.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
    console.error = vi.fn((...args) => {
      consoleOutput.push(`ERROR: ${args.join(' ')}`);
    });

    // Create mock objects
    mockSpec = {
      id: 'spec-123',
      title: '用户认证系统',
      description: '实现用户注册、登录功能',
      content: '## 功能需求\n- 用户注册\n- 用户登录',
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
        {
          id: 'phase-2',
          name: '核心功能开发',
          description: '实现主要业务功能',
          tasks: [
            {
              id: 'task-2-1',
              name: '用户注册功能',
              description: '实现用户注册',
              type: 'development',
              priority: 'critical',
              status: 'pending',
              estimate: { min: 3, max: 5, expected: 4, unit: 'days' },
              dependencies: ['task-1-1'],
              prerequisites: [],
              acceptanceCriteria: ['注册功能正常'],
              technicalRequirements: ['数据库'],
              risks: ['数据验证'],
              tags: ['auth'],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          estimate: { min: 3, max: 5, expected: 4, unit: 'days' },
          prerequisites: [],
          objectives: ['实现核心功能'],
          deliverables: ['注册模块'],
          milestones: ['注册功能完成'],
        },
      ],
      totalEstimate: { min: 10, max: 20, expected: 15, unit: 'days' },
      dependencies: [],
      risks: [
        {
          id: 'risk-1',
          name: '技术风险',
          description: '新技术学习成本',
          category: 'technical',
          impact: 'medium',
          probability: 'medium',
          level: 'medium',
          mitigation: ['技术调研'],
          contingency: ['备选方案'],
        },
        {
          id: 'risk-2',
          name: '时间风险',
          description: '开发时间超出预期',
          category: 'timeline',
          impact: 'high',
          probability: 'medium',
          level: 'high',
          mitigation: ['合理估算'],
          contingency: ['资源增加'],
        },
      ],
      resources: [
        {
          type: 'developer',
          count: 2,
          skills: ['JavaScript', 'Node.js'],
          allocation: { min: 10, max: 15, expected: 12, unit: 'days' },
        },
        {
          type: 'tester',
          count: 1,
          skills: ['测试设计'],
          allocation: { min: 3, max: 5, expected: 4, unit: 'days' },
        },
      ],
      criticalPath: ['task-1-1', 'task-2-1'],
      projectPath: '/test/project',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock services
    mockSpecManager = {
      get: vi.fn(),
    } as any;

    mockPlanManager = {
      create: vi.fn(),
      exportToMarkdown: vi.fn(),
    } as any;

    mockEventBus = {
      on: vi.fn(),
      emit: vi.fn(),
    } as any;

    mockContainer = {
      get: vi.fn((name: string) => {
        switch (name) {
          case 'spec':
            return mockSpecManager;
          case 'plan':
            return mockPlanManager;
          case 'eventBus':
            return mockEventBus;
          default:
            return null;
        }
      }),
    } as any;

    mockApp = {
      getContainer: vi.fn(() => mockContainer),
    } as any;

    command = new SpecWritePlanCommand();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.clearAllMocks();
  });

  describe('命令基本信息', () => {
    it('应该有正确的命令名称和描述', () => {
      expect(command.name).toBe('spec:write-plan');
      expect(command.description).toBe('Generate detailed implementation plan from specification');
      expect(command.aliases).toContain('spec:plan');
      expect(command.aliases).toContain('write-plan');
    });
  });

  describe('参数验证', () => {
    it('应该在没有参数时返回false并显示用法', () => {
      const result = command.validate([]);

      expect(result).toBe(false);
      expect(consoleOutput.some((line) => line.includes('用法: /spec:write-plan'))).toBe(true);
      expect(
        consoleOutput.some((line) => line.includes('示例: /spec:write-plan spec_abc123'))
      ).toBe(true);
    });

    it('应该在有参数时返回true', () => {
      const result = command.validate(['spec-123']);

      expect(result).toBe(true);
    });
  });

  describe('参数解析', () => {
    it('应该解析基本参数', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123'], mockApp);

      expect(mockPlanManager.create).toHaveBeenCalledWith(
        expect.objectContaining({
          specId: 'spec-123',
          options: expect.objectContaining({
            detailLevel: 'detailed',
            teamSize: 'medium',
            complexity: 'medium',
            includeRiskAssessment: true,
            includeResourceAllocation: true,
            includeTimeEstimation: true,
          }),
        })
      );
    });

    it('应该解析详细选项', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123', '--detailed'], mockApp);

      expect(mockPlanManager.create).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            detailLevel: 'comprehensive',
          }),
        })
      );
    });

    it('应该解析团队规模选项', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123', '--team-size', 'large'], mockApp);

      expect(mockPlanManager.create).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            teamSize: 'large',
          }),
        })
      );
    });

    it('应该解析复杂度选项', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123', '--complexity', 'high'], mockApp);

      expect(mockPlanManager.create).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            complexity: 'high',
          }),
        })
      );
    });

    it('应该解析禁用选项', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123', '--no-risks', '--no-resources'], mockApp);

      expect(mockPlanManager.create).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            includeRiskAssessment: false,
            includeResourceAllocation: false,
          }),
        })
      );
    });
  });

  describe('命令执行', () => {
    it('应该成功生成实施计划', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# 实施计划\n\n详细内容...');

      await command.execute(['spec-123'], mockApp);

      expect(mockSpecManager.get).toHaveBeenCalledWith('spec-123');
      expect(mockPlanManager.create).toHaveBeenCalled();
      expect(mockPlanManager.exportToMarkdown).toHaveBeenCalledWith('plan-123');

      // 检查输出内容
      expect(consoleOutput.some((line) => line.includes('开始为规格文档生成实施计划'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('用户认证系统'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('实施计划生成完成'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('包含 2 个阶段，2 个任务'))).toBe(true);
    });

    it('应该在规格文档不存在时显示错误', async () => {
      mockSpecManager.get.mockResolvedValue(null);

      await command.execute(['nonexistent-spec'], mockApp);

      expect(consoleOutput.some((line) => line.includes('规格文档不存在: nonexistent-spec'))).toBe(
        true
      );
      expect(consoleOutput.some((line) => line.includes('使用 /spec:list 查看所有规格文档'))).toBe(
        true
      );
    });

    it('应该处理计划生成失败', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockRejectedValue(new Error('AI服务不可用'));

      await command.execute(['spec-123'], mockApp);

      expect(
        consoleOutput.some((line) => line.includes('ERROR: 生成实施计划失败: AI服务不可用'))
      ).toBe(true);
    });

    it('应该设置事件监听器', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown');

      await command.execute(['spec-123'], mockApp);

      expect(mockEventBus.on).toHaveBeenCalledWith('plan_event', expect.any(Function));
    });
  });

  describe('计划摘要显示', () => {
    it('应该显示完整的计划摘要', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123'], mockApp);

      // 检查摘要内容
      expect(consoleOutput.some((line) => line.includes('实施计划摘要'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('计划名称: 用户认证系统 - 实施计划'))).toBe(
        true
      );
      expect(consoleOutput.some((line) => line.includes('计划ID: plan-123'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('总时间估算: 10-20 days'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('阶段数量: 2'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('任务总数: 2'))).toBe(true);
    });

    it('应该显示阶段概览', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123'], mockApp);

      expect(consoleOutput.some((line) => line.includes('阶段概览'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('1. 项目初始化 (1 个任务'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('2. 核心功能开发 (1 个任务'))).toBe(true);
    });

    it('应该显示风险概览', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123'], mockApp);

      expect(consoleOutput.some((line) => line.includes('风险概览'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('🟡 medium: 1 个风险'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('🟠 high: 1 个风险'))).toBe(true);
    });

    it('应该显示资源需求', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown content');

      await command.execute(['spec-123'], mockApp);

      expect(consoleOutput.some((line) => line.includes('资源需求'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('👨‍💻 developer: 2 人'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('🧪 tester: 1 人'))).toBe(true);
    });
  });

  describe('Markdown导出', () => {
    it('应该成功导出Markdown', async () => {
      const markdownContent =
        '# 用户认证系统 - 实施计划\n\n## 详细内容\n\n这是一个完整的实施计划...';

      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue(markdownContent);

      await command.execute(['spec-123'], mockApp);

      expect(mockPlanManager.exportToMarkdown).toHaveBeenCalledWith('plan-123');
      expect(consoleOutput.some((line) => line.includes('Markdown 内容已生成'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('用户认证系统_实施计划_plan.md'))).toBe(
        true
      );
      expect(consoleOutput.some((line) => line.includes('# 用户认证系统 - 实施计划'))).toBe(true);
    });

    it('应该处理导出失败', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockRejectedValue(new Error('导出失败'));

      await command.execute(['spec-123'], mockApp);

      expect(consoleOutput.some((line) => line.includes('导出失败: 导出失败'))).toBe(true);
    });

    it('应该显示后续操作提示', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown');

      await command.execute(['spec-123'], mockApp);

      expect(consoleOutput.some((line) => line.includes('后续操作'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('/spec:execute-plan plan-123'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('/spec:list-plans'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('/spec:show-plan plan-123'))).toBe(true);
    });
  });

  describe('辅助方法', () => {
    it('应该正确格式化选项', async () => {
      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(mockPlan);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown');

      await command.execute(
        ['spec-123', '--detailed', '--team-size', 'large', '--no-risks'],
        mockApp
      );

      expect(
        consoleOutput.some(
          (line) =>
            line.includes('详细程度=comprehensive') &&
            line.includes('团队规模=large') &&
            line.includes('包含资源分配')
        )
      ).toBe(true);
    });

    it('应该正确获取风险图标', async () => {
      const planWithCriticalRisk = {
        ...mockPlan,
        risks: [
          {
            id: 'risk-critical',
            name: '严重风险',
            description: '严重问题',
            category: 'technical' as const,
            impact: 'critical' as const,
            probability: 'high' as const,
            level: 'critical' as const,
            mitigation: [],
            contingency: [],
          },
        ],
      };

      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(planWithCriticalRisk);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown');

      await command.execute(['spec-123'], mockApp);

      expect(consoleOutput.some((line) => line.includes('🔴 critical: 1 个风险'))).toBe(true);
    });

    it('应该正确获取资源图标', async () => {
      const planWithDesigner = {
        ...mockPlan,
        resources: [
          {
            type: 'designer' as const,
            count: 1,
            skills: ['UI设计'],
            allocation: { min: 5, max: 8, expected: 6, unit: 'days' as const },
          },
        ],
      };

      mockSpecManager.get.mockResolvedValue(mockSpec);
      mockPlanManager.create.mockResolvedValue(planWithDesigner);
      mockPlanManager.exportToMarkdown.mockResolvedValue('# Markdown');

      await command.execute(['spec-123'], mockApp);

      expect(consoleOutput.some((line) => line.includes('🎨 designer: 1 人'))).toBe(true);
    });
  });
});
