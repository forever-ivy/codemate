import type { DocumentTemplate } from '../types.js';

/**
 * 架构设计文档模板
 */
export const architectureTemplate: DocumentTemplate = {
  id: 'architecture_design_v1',
  name: '架构设计文档',
  type: 'architecture',
  description: '专注于系统架构设计的技术文档模板',
  sections: [
    {
      id: 'architecture_overview',
      title: '架构概述',
      order: 1,
      required: true,
      contentType: 'text',
      aiPrompt: '基于 Spec 数据生成系统架构概述，包括架构目标、设计原则、技术选型',
    },
    {
      id: 'system_architecture',
      title: '系统架构',
      order: 2,
      required: true,
      contentType: 'diagram',
      aiPrompt: '生成系统整体架构图和组件关系描述',
      subsections: [
        {
          id: 'overall_architecture',
          title: '整体架构',
          order: 1,
          contentType: 'diagram',
          aiPrompt: '描述系统的整体架构和层次结构',
        },
        {
          id: 'component_architecture',
          title: '组件架构',
          order: 2,
          contentType: 'text',
          aiPrompt: '详细描述各个组件的职责和交互关系',
        },
      ],
    },
    {
      id: 'technical_architecture',
      title: '技术架构',
      order: 3,
      required: true,
      contentType: 'text',
      aiPrompt: '描述技术架构选型和实现方案',
      subsections: [
        {
          id: 'tech_stack',
          title: '技术栈',
          order: 1,
          contentType: 'table',
          aiPrompt: '整理项目使用的技术栈和版本信息',
        },
        {
          id: 'architecture_patterns',
          title: '架构模式',
          order: 2,
          contentType: 'text',
          aiPrompt: '说明采用的架构模式和设计模式',
        },
      ],
    },
    {
      id: 'data_architecture',
      title: '数据架构',
      order: 4,
      required: true,
      contentType: 'diagram',
      aiPrompt: '设计数据架构和数据流向',
      subsections: [
        {
          id: 'data_model',
          title: '数据模型',
          order: 1,
          contentType: 'diagram',
          aiPrompt: '设计核心数据模型和实体关系',
        },
        {
          id: 'data_flow',
          title: '数据流向',
          order: 2,
          contentType: 'diagram',
          aiPrompt: '描述系统中的数据流向和处理过程',
        },
      ],
    },
    {
      id: 'deployment_architecture',
      title: '部署架构',
      order: 5,
      required: true,
      contentType: 'diagram',
      aiPrompt: '设计系统部署架构和基础设施',
      subsections: [
        {
          id: 'infrastructure',
          title: '基础设施',
          order: 1,
          contentType: 'text',
          aiPrompt: '描述系统所需的基础设施和资源',
        },
        {
          id: 'deployment_strategy',
          title: '部署策略',
          order: 2,
          contentType: 'text',
          aiPrompt: '制定系统部署和发布策略',
        },
      ],
    },
    {
      id: 'security_architecture',
      title: '安全架构',
      order: 6,
      required: true,
      contentType: 'text',
      aiPrompt: '设计系统安全架构和防护措施',
    },
    {
      id: 'performance_architecture',
      title: '性能架构',
      order: 7,
      required: false,
      contentType: 'text',
      aiPrompt: '设计系统性能优化和扩展方案',
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'AI Document Generator',
    createdAt: new Date('2024-01-01'),
    tags: ['architecture', 'system-design', 'technical'],
    estimatedGenerationTime: 180, // 3 分钟
  },
};
