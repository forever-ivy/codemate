import type { DocumentTemplate } from '../types.js';

/**
 * 测试计划文档模板
 */
export const testingTemplate: DocumentTemplate = {
  id: 'testing_plan_v1',
  name: '测试计划文档',
  type: 'testing',
  description: '专注于测试策略和计划的文档模板',
  sections: [
    {
      id: 'testing_overview',
      title: '测试概述',
      order: 1,
      required: true,
      contentType: 'text',
      aiPrompt: '基于 Spec 数据生成测试概述，包括测试目标、测试范围、质量标准',
    },
    {
      id: 'testing_strategy',
      title: '测试策略',
      order: 2,
      required: true,
      contentType: 'text',
      aiPrompt: '制定全面的测试策略和方法论',
      subsections: [
        {
          id: 'test_levels',
          title: '测试层级',
          order: 1,
          contentType: 'text',
          aiPrompt: '定义单元测试、集成测试、系统测试等层级',
        },
        {
          id: 'test_types',
          title: '测试类型',
          order: 2,
          contentType: 'text',
          aiPrompt: '定义功能测试、性能测试、安全测试等类型',
        },
      ],
    },
    {
      id: 'unit_testing',
      title: '单元测试',
      order: 3,
      required: true,
      contentType: 'text',
      aiPrompt: '设计单元测试策略和实现方案',
      subsections: [
        {
          id: 'unit_test_framework',
          title: '测试框架',
          order: 1,
          contentType: 'text',
          aiPrompt: '选择和配置单元测试框架',
        },
        {
          id: 'unit_test_coverage',
          title: '覆盖率要求',
          order: 2,
          contentType: 'text',
          aiPrompt: '制定代码覆盖率目标和检查机制',
        },
      ],
    },
    {
      id: 'integration_testing',
      title: '集成测试',
      order: 4,
      required: true,
      contentType: 'text',
      aiPrompt: '设计集成测试方案和测试用例',
      subsections: [
        {
          id: 'api_testing',
          title: 'API 测试',
          order: 1,
          contentType: 'text',
          aiPrompt: '设计 API 接口测试用例和自动化方案',
        },
        {
          id: 'database_testing',
          title: '数据库测试',
          order: 2,
          contentType: 'text',
          aiPrompt: '设计数据库集成测试和数据验证',
        },
      ],
    },
    {
      id: 'e2e_testing',
      title: '端到端测试',
      order: 5,
      required: true,
      contentType: 'text',
      aiPrompt: '设计端到端测试场景和自动化方案',
      subsections: [
        {
          id: 'user_scenarios',
          title: '用户场景',
          order: 1,
          contentType: 'text',
          aiPrompt: '设计关键用户场景的端到端测试',
        },
        {
          id: 'automation_framework',
          title: '自动化框架',
          order: 2,
          contentType: 'text',
          aiPrompt: '选择和配置 E2E 测试自动化框架',
        },
      ],
    },
    {
      id: 'performance_testing',
      title: '性能测试',
      order: 6,
      required: false,
      contentType: 'text',
      aiPrompt: '设计性能测试策略和基准',
      subsections: [
        {
          id: 'load_testing',
          title: '负载测试',
          order: 1,
          contentType: 'text',
          aiPrompt: '设计系统负载测试和压力测试',
        },
        {
          id: 'performance_metrics',
          title: '性能指标',
          order: 2,
          contentType: 'text',
          aiPrompt: '定义关键性能指标和监控方案',
        },
      ],
    },
    {
      id: 'security_testing',
      title: '安全测试',
      order: 7,
      required: false,
      contentType: 'text',
      aiPrompt: '设计安全测试策略和漏洞检测',
    },
    {
      id: 'test_automation',
      title: '测试自动化',
      order: 8,
      required: false,
      contentType: 'text',
      aiPrompt: '建立测试自动化流程和 CI/CD 集成',
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'AI Document Generator',
    createdAt: new Date('2024-01-01'),
    tags: ['testing', 'quality-assurance', 'automation'],
    estimatedGenerationTime: 150, // 2.5 分钟
  },
};
