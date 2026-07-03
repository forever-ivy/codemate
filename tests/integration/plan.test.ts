import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'pathe';
import { mkdir, rmdir, writeFile } from 'node:fs/promises';
import { PlanManager } from '../../src/spec/plan/PlanManager.js';
import { PlanStorage } from '../../src/spec/plan/PlanStorage.js';
import { PlanGenerator } from '../../src/spec/plan/PlanGenerator.js';
import { SpecWritePlanCommand } from '../../src/commands/spec/SpecWritePlanCommand.js';
import { EventBus } from '../../src/services/EventBus.js';
import type { Paths } from '../../src/services/Paths.js';
import type { SpecDocument } from '../../src/spec/types.js';
import type {
  CreatePlanRequest,
  PlanGenerationOptions,
  ImplementationPlan,
} from '../../src/spec/plan/types.js';

// Mock file system operations for testing
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual('node:fs/promises');
  return {
    ...actual,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(),
    rmdir: vi.fn(),
  };
});

describe('Plan System Integration', () => {
  let planManager: PlanManager;
  let planStorage: PlanStorage;
  let eventBus: EventBus;
  let mockPaths: Paths;
  let mockSpecManager: any;
  let mockModelService: any;
  let testDataDir: string;
  let mockSpec: SpecDocument;

  beforeEach(async () => {
    testDataDir = '/tmp/test-plans';

    // Mock Paths service
    mockPaths = {
      getDataDir: vi.fn(() => testDataDir),
      getCwd: vi.fn(() => '/test/project'),
    } as any;

    // Mock SpecManager
    mockSpec = {
      id: 'spec-123',
      title: '用户认证系统',
      description: '实现用户注册、登录、权限管理功能',
      content: `# 用户认证系统

## 功能需求

### 用户注册
- 用户可以通过邮箱注册账号
- 支持邮箱验证
- 密码强度验证

### 用户登录
- 支持邮箱/用户名登录
- 支持记住登录状态
- 支持密码重置

### 权限管理
- 基于角色的权限控制
- 支持多级权限
- 权限继承机制

## 技术要求
- 使用 Node.js + Express
- 数据库使用 PostgreSQL
- 前端使用 React
- 支持 JWT 认证`,
      projectPath: '/test/project',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockSpecManager = {
      get: vi.fn().mockResolvedValue(mockSpec),
      list: vi.fn().mockResolvedValue([mockSpec]),
    };

    // Mock ModelService with realistic AI responses
    mockModelService = {
      chat: vi.fn().mockImplementation((prompt: string) => {
        if (prompt.includes('分析以下规格文档')) {
          return Promise.resolve(
            JSON.stringify({
              complexity: 'medium',
              features: ['用户注册', '用户登录', '权限管理', '邮箱验证', '密码重置'],
              technologies: ['Node.js', 'Express', 'PostgreSQL', 'React', 'JWT'],
              constraints: ['安全要求', '性能要求', '可扩展性'],
            })
          );
        }

        if (prompt.includes('生成详细的实施计划阶段')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'phase-1',
                name: '项目初始化与环境搭建',
                description: '搭建项目基础架构和开发环境',
                tasks: [
                  {
                    id: 'task-1-1',
                    name: '项目结构搭建',
                    description: '创建项目目录结构，配置基础文件',
                    type: 'setup',
                    priority: 'high',
                    status: 'pending',
                    estimate: { min: 1, max: 2, expected: 1.5, unit: 'days' },
                    dependencies: [],
                    prerequisites: [],
                    acceptanceCriteria: ['项目结构完整', '配置文件正确', '依赖安装成功'],
                    technicalRequirements: ['Node.js 18+', 'npm/yarn', 'Git'],
                    risks: ['环境配置问题', '依赖冲突'],
                    tags: ['setup', 'infrastructure'],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  {
                    id: 'task-1-2',
                    name: '数据库设计与搭建',
                    description: '设计数据库表结构，搭建PostgreSQL环境',
                    type: 'setup',
                    priority: 'high',
                    status: 'pending',
                    estimate: { min: 2, max: 3, expected: 2.5, unit: 'days' },
                    dependencies: ['task-1-1'],
                    prerequisites: ['项目结构已搭建'],
                    acceptanceCriteria: ['数据库表创建完成', '索引优化', '数据迁移脚本'],
                    technicalRequirements: ['PostgreSQL', 'Sequelize/Prisma'],
                    risks: ['数据模型设计不当', '性能问题'],
                    tags: ['database', 'setup'],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ],
                estimate: { min: 3, max: 5, expected: 4, unit: 'days' },
                prerequisites: [],
                objectives: ['建立开发基础', '完成环境配置'],
                deliverables: ['项目骨架', '数据库结构', '开发环境'],
                milestones: ['开发环境就绪'],
              },
              {
                id: 'phase-2',
                name: '核心认证功能开发',
                description: '实现用户注册、登录、权限管理核心功能',
                tasks: [
                  {
                    id: 'task-2-1',
                    name: '用户注册功能',
                    description: '实现用户注册接口和邮箱验证',
                    type: 'development',
                    priority: 'critical',
                    status: 'pending',
                    estimate: { min: 3, max: 5, expected: 4, unit: 'days' },
                    dependencies: ['task-1-2'],
                    prerequisites: ['数据库已搭建'],
                    acceptanceCriteria: ['注册接口正常', '邮箱验证功能', '密码加密存储'],
                    technicalRequirements: ['bcrypt', 'nodemailer', '表单验证'],
                    risks: ['邮件服务不稳定', '验证逻辑漏洞'],
                    tags: ['auth', 'registration'],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  {
                    id: 'task-2-2',
                    name: '用户登录功能',
                    description: '实现用户登录接口和JWT认证',
                    type: 'development',
                    priority: 'critical',
                    status: 'pending',
                    estimate: { min: 2, max: 4, expected: 3, unit: 'days' },
                    dependencies: ['task-2-1'],
                    prerequisites: ['用户注册功能完成'],
                    acceptanceCriteria: ['登录接口正常', 'JWT生成和验证', '会话管理'],
                    technicalRequirements: ['jsonwebtoken', 'passport.js'],
                    risks: ['JWT安全配置', '会话管理复杂'],
                    tags: ['auth', 'login'],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ],
                estimate: { min: 5, max: 9, expected: 7, unit: 'days' },
                prerequisites: ['项目初始化完成'],
                objectives: ['实现核心认证功能', '确保安全性'],
                deliverables: ['注册模块', '登录模块', 'JWT认证'],
                milestones: ['基础认证功能完成'],
              },
            ])
          );
        }

        if (prompt.includes('评估项目风险')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'risk-1',
                name: '技术选型风险',
                description: '新技术栈学习成本高，可能影响开发进度',
                category: 'technical',
                impact: 'medium',
                probability: 'medium',
                level: 'medium',
                mitigation: ['提前技术调研', '团队培训', '原型验证'],
                contingency: ['备选技术方案', '外部技术支持'],
              },
              {
                id: 'risk-2',
                name: '安全风险',
                description: '认证系统安全漏洞可能导致数据泄露',
                category: 'technical',
                impact: 'critical',
                probability: 'low',
                level: 'high',
                mitigation: ['安全代码审查', '渗透测试', '安全培训'],
                contingency: ['安全专家咨询', '第三方安全审计'],
              },
              {
                id: 'risk-3',
                name: '时间风险',
                description: '开发时间可能超出预期',
                category: 'timeline',
                impact: 'high',
                probability: 'medium',
                level: 'medium',
                mitigation: ['合理时间估算', '定期进度检查', '敏捷开发'],
                contingency: ['功能优先级调整', '增加开发资源'],
              },
            ])
          );
        }

        return Promise.resolve('{}');
      }),
    };

    // Initialize services
    eventBus = new EventBus();
    planStorage = new PlanStorage(mockPaths);
    planManager = new PlanManager(planStorage, mockSpecManager, eventBus, mockModelService);

    // Mock file system operations
    const {
      mkdir: mkdirMock,
      writeFile: writeFileMock,
      readFile: readFileMock,
    } = await import('node:fs/promises');
    vi.mocked(mkdirMock).mockResolvedValue(undefined);
    vi.mocked(writeFileMock).mockResolvedValue(undefined);
    vi.mocked(readFileMock).mockImplementation((path: string) => {
      // Return mock plan data when reading plan files
      const mockPlan = {
        id: 'plan-123',
        specId: 'spec-123',
        name: '用户认证系统 - 实施计划',
        description: '基于规格文档生成的详细实施计划',
        phases: [],
        totalEstimate: { min: 15, max: 25, expected: 20, unit: 'days' },
        dependencies: [],
        risks: [],
        resources: [],
        criticalPath: [],
        projectPath: '/test/project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return Promise.resolve(JSON.stringify(mockPlan));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('完整的计划生成流程', () => {
    it('应该能从规格文档生成完整的实施计划', async () => {
      const request: CreatePlanRequest = {
        specId: 'spec-123',
        options: {
          detailLevel: 'comprehensive',
          includeRiskAssessment: true,
          includeResourceAllocation: true,
          includeTimeEstimation: true,
          teamSize: 'medium',
          complexity: 'medium',
        },
        projectPath: '/test/project',
      };

      const plan = await planManager.create(request);

      expect(plan).toBeDefined();
      expect(plan.specId).toBe('spec-123');
      expect(plan.name).toContain('用户认证系统');
      expect(plan.phases.length).toBeGreaterThan(0);
      expect(plan.totalEstimate).toBeDefined();
      expect(plan.risks.length).toBeGreaterThan(0);
      expect(plan.resources.length).toBeGreaterThan(0);

      // 验证AI生成的内容
      expect(plan.phases[0].name).toBe('项目初始化与环境搭建');
      expect(plan.phases[1].name).toBe('核心认证功能开发');

      // 验证任务依赖关系
      const task12 = plan.phases[0].tasks.find((t) => t.id === 'task-1-2');
      expect(task12?.dependencies).toContain('task-1-1');

      const task21 = plan.phases[1].tasks.find((t) => t.id === 'task-2-1');
      expect(task21?.dependencies).toContain('task-1-2');
    });

    it('应该能处理不同的生成选项', async () => {
      const basicRequest: CreatePlanRequest = {
        specId: 'spec-123',
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

      const plan = await planManager.create(basicRequest);

      expect(plan).toBeDefined();
      expect(plan.risks.length).toBe(0); // 不包含风险评估
      expect(plan.resources.length).toBe(0); // 不包含资源分配
    });

    it('应该能在AI服务失败时使用备用计划', async () => {
      // Mock AI service failure
      mockModelService.chat.mockRejectedValue(new Error('AI服务不可用'));

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

      const plan = await planManager.create(request);

      expect(plan).toBeDefined();
      expect(plan.phases.length).toBe(3); // 备用计划有3个阶段
      expect(plan.risks.length).toBe(3); // 备用风险
      expect(plan.totalEstimate.unit).toBe('days');
    });
  });

  describe('计划管理操作', () => {
    let testPlan: ImplementationPlan;

    beforeEach(async () => {
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

      testPlan = await planManager.create(request);
    });

    it('应该能更新任务状态', async () => {
      const taskId = testPlan.phases[0].tasks[0].id;

      const updatedPlan = await planManager.updateTaskStatus(testPlan.id, taskId, 'in_progress');

      expect(updatedPlan).toBeDefined();
      expect(updatedPlan?.phases[0].tasks[0].status).toBe('in_progress');
    });

    it('应该能计算计划进度', () => {
      const progress = planManager.getProgress(testPlan);

      expect(progress).toBeDefined();
      expect(progress.totalTasks).toBeGreaterThan(0);
      expect(progress.percentage).toBe(0); // 所有任务都是pending状态
    });

    it('应该能复制计划', async () => {
      const duplicatedPlan = await planManager.duplicate(testPlan.id, '复制的计划');

      expect(duplicatedPlan).toBeDefined();
      expect(duplicatedPlan?.name).toBe('复制的计划');
      expect(duplicatedPlan?.id).not.toBe(testPlan.id);
      expect(duplicatedPlan?.phases.length).toBe(testPlan.phases.length);
    });

    it('应该能验证计划', async () => {
      const validation = await planManager.validatePlan(testPlan.id);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该能导出计划为Markdown', async () => {
      const markdown = await planManager.exportToMarkdown(testPlan.id);

      expect(markdown).toBeDefined();
      expect(markdown).toContain('# 用户认证系统 - 实施计划');
      expect(markdown).toContain('## 实施阶段');
      expect(markdown).toContain('## 风险评估');
    });
  });

  describe('事件系统集成', () => {
    it('应该在计划创建时发送事件', async () => {
      const eventSpy = vi.fn();
      eventBus.on('plan_event', eventSpy);

      const request: CreatePlanRequest = {
        specId: 'spec-123',
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

      await planManager.create(request);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plan_created',
          data: expect.objectContaining({
            specId: 'spec-123',
          }),
        })
      );
    });

    it('应该在任务状态更新时发送事件', async () => {
      const request: CreatePlanRequest = {
        specId: 'spec-123',
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

      const plan = await planManager.create(request);

      const eventSpy = vi.fn();
      eventBus.on('plan_event', eventSpy);

      const taskId = plan.phases[0].tasks[0].id;
      await planManager.updateTaskStatus(plan.id, taskId, 'completed');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_status_updated',
          data: expect.objectContaining({
            planId: plan.id,
            taskId,
            status: 'completed',
          }),
        })
      );
    });
  });

  describe('命令行接口集成', () => {
    let command: SpecWritePlanCommand;
    let mockApp: any;
    let consoleOutput: string[];

    beforeEach(() => {
      command = new SpecWritePlanCommand();

      // Mock console output
      consoleOutput = [];
      const originalConsoleLog = console.log;
      console.log = vi.fn((...args) => {
        consoleOutput.push(args.join(' '));
      });

      // Mock Application
      mockApp = {
        getContainer: vi.fn(() => ({
          get: vi.fn((name: string) => {
            switch (name) {
              case 'spec':
                return mockSpecManager;
              case 'plan':
                return planManager;
              case 'eventBus':
                return eventBus;
              default:
                return null;
            }
          }),
        })),
      };
    });

    it('应该能通过命令行生成计划', async () => {
      await command.execute(['spec-123'], mockApp);

      expect(consoleOutput.some((line) => line.includes('开始为规格文档生成实施计划'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('实施计划生成完成'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('实施计划摘要'))).toBe(true);
    });

    it('应该能处理不同的命令行选项', async () => {
      await command.execute(
        ['spec-123', '--detailed', '--team-size', 'large', '--complexity', 'high'],
        mockApp
      );

      expect(
        consoleOutput.some(
          (line) =>
            line.includes('详细程度=comprehensive') &&
            line.includes('团队规模=large') &&
            line.includes('复杂度=high')
        )
      ).toBe(true);
    });
  });

  describe('存储系统集成', () => {
    it('应该能持久化计划数据', async () => {
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

      const plan = await planManager.create(request);

      // 验证保存操作
      const { writeFile } = await import('node:fs/promises');
      expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
        expect.stringContaining(`${plan.id}.json`),
        expect.stringContaining(plan.id),
        'utf-8'
      );
    });

    it('应该能获取计划统计信息', async () => {
      // Mock readdir to return plan files
      const { readdir } = await import('node:fs/promises');
      vi.mocked(readdir).mockResolvedValue(['plan-123.json', 'plan-456.json'] as any);

      const stats = await planManager.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalPlans).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理规格文档不存在的情况', async () => {
      mockSpecManager.get.mockResolvedValue(null);

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

      await expect(planManager.create(request)).rejects.toThrow('规格文档不存在');
    });

    it('应该处理存储失败的情况', async () => {
      const { writeFile } = await import('node:fs/promises');
      vi.mocked(writeFile).mockRejectedValue(new Error('磁盘空间不足'));

      const request: CreatePlanRequest = {
        specId: 'spec-123',
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

      await expect(planManager.create(request)).rejects.toThrow();
    });

    it('应该处理无效的任务状态更新', async () => {
      const request: CreatePlanRequest = {
        specId: 'spec-123',
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

      const plan = await planManager.create(request);

      await expect(
        planManager.updateTaskStatus(plan.id, 'nonexistent-task', 'completed')
      ).rejects.toThrow('任务不存在');
    });
  });
});
