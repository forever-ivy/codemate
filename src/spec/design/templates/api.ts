import type { DocumentTemplate } from '../types.js';

/**
 * API 设计文档模板
 */
export const apiTemplate: DocumentTemplate = {
  id: 'api_design_v1',
  name: 'API 设计文档',
  type: 'api',
  description: '专注于 API 接口设计的技术文档模板',
  sections: [
    {
      id: 'api_overview',
      title: 'API 概述',
      order: 1,
      required: true,
      contentType: 'text',
      aiPrompt: '基于 Spec 数据生成 API 概述，包括 API 目标、设计原则、版本策略',
    },
    {
      id: 'api_specification',
      title: 'API 规范',
      order: 2,
      required: true,
      contentType: 'code',
      aiPrompt: '生成详细的 API 接口规范和文档',
      subsections: [
        {
          id: 'rest_apis',
          title: 'REST API',
          order: 1,
          contentType: 'code',
          aiPrompt: '设计 REST API 接口和路由规范',
        },
        {
          id: 'graphql_apis',
          title: 'GraphQL API',
          order: 2,
          contentType: 'code',
          aiPrompt: '设计 GraphQL Schema 和查询接口',
        },
      ],
    },
    {
      id: 'data_models',
      title: '数据模型',
      order: 3,
      required: true,
      contentType: 'code',
      aiPrompt: '定义 API 使用的数据模型和结构',
      subsections: [
        {
          id: 'request_models',
          title: '请求模型',
          order: 1,
          contentType: 'code',
          aiPrompt: '定义 API 请求的数据模型和验证规则',
        },
        {
          id: 'response_models',
          title: '响应模型',
          order: 2,
          contentType: 'code',
          aiPrompt: '定义 API 响应的数据模型和格式',
        },
      ],
    },
    {
      id: 'authentication',
      title: '认证授权',
      order: 4,
      required: true,
      contentType: 'text',
      aiPrompt: '设计 API 认证和授权机制',
      subsections: [
        {
          id: 'auth_methods',
          title: '认证方式',
          order: 1,
          contentType: 'text',
          aiPrompt: '说明支持的认证方式和实现方案',
        },
        {
          id: 'permission_control',
          title: '权限控制',
          order: 2,
          contentType: 'text',
          aiPrompt: '设计 API 权限控制和访问策略',
        },
      ],
    },
    {
      id: 'error_handling',
      title: '错误处理',
      order: 5,
      required: true,
      contentType: 'table',
      aiPrompt: '整理 API 的错误码和处理机制',
      subsections: [
        {
          id: 'error_codes',
          title: '错误码定义',
          order: 1,
          contentType: 'table',
          aiPrompt: '定义标准的 API 错误码和含义',
        },
        {
          id: 'error_responses',
          title: '错误响应',
          order: 2,
          contentType: 'code',
          aiPrompt: '设计统一的错误响应格式',
        },
      ],
    },
    {
      id: 'api_testing',
      title: 'API 测试',
      order: 6,
      required: false,
      contentType: 'text',
      aiPrompt: '设计 API 测试策略和测试用例',
    },
    {
      id: 'api_documentation',
      title: 'API 文档',
      order: 7,
      required: false,
      contentType: 'text',
      aiPrompt: '制定 API 文档生成和维护策略',
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'AI Document Generator',
    createdAt: new Date('2024-01-01'),
    tags: ['api', 'interface', 'specification'],
    estimatedGenerationTime: 120, // 2 分钟
  },
};
