import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanGenerator } from '../../../src/spec/plan/PlanGenerator.js';
import type { SpecDocument } from '../../../src/spec/types.js';
import type { PlanGenerationOptions } from '../../../src/spec/plan/types.js';

// Mock ModelService
const mockModelService = {
  chat: vi.fn(),
};

describe('PlanGenerator', () => {
  let generator: PlanGenerator;
  let mockSpec: SpecDocument;

  beforeEach(() => {
    generator = new PlanGenerator(mockModelService as any);
    vi.clearAllMocks();

    mockSpec = {
      id: 'spec-123',
      title: '用户认证系统',
      description: '实现用户注册、登录、权限管理功能',
      content: '## 功能需求\n- 用户注册\n- 用户登录\n- 密码重置',
      tags: ['auth', 'user', 'security'],
      projectPath: '/test/project',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('计划生成', () => {
    it('应该能生成基础实施计划', async () => {
      const options: PlanGenerationOptions = {
        detailLevel: 'basic',
        includeRiskAssessment: false,
        includeResourceAllocation: false,
        includeTimeEstimation: true,
        teamSize: 'small',
        complexity: 'low',
      };

      // Mock AI 响应失败，使用备用计划
      mockModelService.chat.mockRejectedValue(new Error('AI服务不可用'));

      const plan = await generator.generatePlan(mockSpec, options, '/test/project');

      expect(plan).toBeDefined();
      expect(plan.specId).toBe(mockSpec.id);
      expect(plan.name).toContain(mockSpec.title);
      expect(plan.phases.length).toBeGreaterThan(0);
      expect(plan.totalEstimate).toBeDefined();
      expect(plan.projectPath).toBe('/test/project');
    });

    it('应该能生成详细实施计划', async () => {
      const options: PlanGenerationOptions = {
        detailLevel: 'comprehensive',
        includeRiskAssessment: true,
        includeResourceAllocation: true,
        includeTimeEstimation: true,
        teamSize: 'medium',
        complexity: 'medium',
      };

      // Mock 成功的AI响应
      const mockAnalysisResponse = JSON.stringify({
        complexity: 'medium',
        features: ['用户注册', '用户登录', '权限管理'],
        technologies: ['JavaScript', 'Node.js', 'React'],
        constraints: ['安全要求', '性能要求'],
      });

      const mockPhasesResponse = JSON.stringify([
        {
          id: 'phase-1',
          name: '项目初始化',
          description: '搭建项目基础架构',
          tasks: [
            {
              id: 'task-1-1',
              name: '项目结构搭建',
              description: '创建项目目录结构',
              type: 'setup',
              priority: 'high',
              status: 'pending',
              estimate: { min: 1, max: 2, expected: 1.5, unit: 'days' },
              dependencies: [],
              prerequisites: [],
              acceptanceCriteria: ['项目结构完整'],
              technicalRequirements: ['Node.js'],
              risks: ['环境配置问题'],
              tags: ['setup'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          estimate: { min: 1, max: 2, expected: 1.5, unit: 'days' },
          prerequisites: [],
          objectives: ['建立开发基础'],
          deliverables: ['项目骨架'],
          milestones: ['开发环境就绪'],
        },
      ]);

      const mockRisksResponse = JSON.stringify([
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
      ]);

      mockModelService.chat
        .mockResolvedValueOnce(mockAnalysisResponse)
        .mockResolvedValueOnce(mockPhasesResponse)
        .mockResolvedValueOnce(mockRisksResponse);

      const plan = await generator.generatePlan(mockSpec, options, '/test/project');

      expect(plan).toBeDefined();
      expect(plan.phases.length).toBeGreaterThan(0);
      expect(plan.risks.length).toBeGreaterThan(0);
      expect(plan.resources.length).toBeGreaterThan(0);
      expect(mockModelService.chat).toHaveBeenCalledTimes(3);
    });

    it('应该在AI失败时使用备用计划', async () => {
      const options: PlanGenerationOptions = {
        detailLevel: 'detailed',
        includeRiskAssessment: true,
        includeResourceAllocation: true,
        includeTimeEstimation: true,
        teamSize: 'large',
        complexity: 'high',
      };

      mockModelService.chat.mockRejectedValue(new Error('AI服务不可用'));

      const plan = await generator.generatePlan(mockSpec, options, '/test/project');

      expect(plan).toBeDefined();
      expect(plan.phases.length).toBe(3); // 备用计划有3个阶段
      expect(plan.risks.length).toBe(3); // 备用风险有3个
      expect(plan.totalEstimate.unit).toBe('days');
    });
  });

  describe('JSON解析', () => {
    it('应该能清理markdown代码块', async () => {
      const options: PlanGenerationOptions = {
        detailLevel: 'basic',
        includeRiskAssessment: false,
        includeResourceAllocation: false,
        includeTimeEstimation: true,
        teamSize: 'small',
        complexity: 'low',
      };

      const mockResponse =
        '```json\n{"complexity": "low", "features": [], "technologies": [], "constraints": []}\n```';
      mockModelService.chat.mockResolvedValue(mockResponse);

      const plan = await generator.generatePlan(mockSpec, options, '/test/project');

      expect(plan).toBeDefined();
      expect(mockModelService.chat).toHaveBeenCalled();
    });

    it('应该能处理无效JSON', async () => {
      const options: PlanGenerationOptions = {
        detailLevel: 'basic',
        includeRiskAssessment: false,
        includeResourceAllocation: false,
        includeTimeEstimation: true,
        teamSize: 'small',
        complexity: 'low',
      };

      mockModelService.chat.mockResolvedValue('无效的JSON响应');

      const plan = await generator.generatePlan(mockSpec, options, '/test/project');

      expect(plan).toBeDefined();
      // 应该使用备用计划
      expect(plan.phases.length).toBeGreaterThan(0);
    });
  });

  describe('资源分配', () => {
    it('应该根据团队规模分配资源', async () => {
      const smallTeamOptions: PlanGenerationOptions = {
        detailLevel: 'basic',
        includeRiskAssessment: false,
        includeResourceAllocation: true,
        includeTimeEstimation: true,
        teamSize: 'small',
        complexity: 'low',
      };

      mockModelService.chat.mockRejectedValue(new Error('使用备用计划'));

      const plan = await generator.generatePlan(mockSpec, smallTeamOptions, '/test/project');

      expect(plan.resources.length).toBeGreaterThan(0);

      // 检查开发者资源分配
      const developerResource = plan.resources.find((r) => r.type === 'developer');
      if (developerResource) {
        expect(developerResource.count).toBeLessThanOrEqual(2); // 小团队开发者数量
      }
    });
  });

  describe('时间估算', () => {
    it('应该计算正确的总时间估算', async () => {
      const options: PlanGenerationOptions = {
        detailLevel: 'basic',
        includeRiskAssessment: false,
        includeResourceAllocation: false,
        includeTimeEstimation: true,
        teamSize: 'medium',
        complexity: 'medium',
      };

      mockModelService.chat.mockRejectedValue(new Error('使用备用计划'));

      const plan = await generator.generatePlan(mockSpec, options, '/test/project');

      expect(plan.totalEstimate).toBeDefined();
      expect(plan.totalEstimate.min).toBeGreaterThan(0);
      expect(plan.totalEstimate.max).toBeGreaterThan(plan.totalEstimate.min);
      expect(plan.totalEstimate.expected).toBeGreaterThanOrEqual(plan.totalEstimate.min);
      expect(plan.totalEstimate.expected).toBeLessThanOrEqual(plan.totalEstimate.max);
      expect(plan.totalEstimate.unit).toBe('days');
    });
  });
});
