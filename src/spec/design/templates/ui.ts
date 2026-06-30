import type { DocumentTemplate } from '../types.js';

/**
 * UI 设计文档模板
 */
export const uiTemplate: DocumentTemplate = {
  id: 'ui_design_v1',
  name: 'UI 设计文档',
  type: 'ui',
  description: '专注于用户界面设计的文档模板',
  sections: [
    {
      id: 'ui_overview',
      title: 'UI 设计概述',
      order: 1,
      required: true,
      contentType: 'text',
      aiPrompt: '基于 Spec 数据生成 UI 设计概述，包括设计目标、用户体验原则、设计风格',
    },
    {
      id: 'design_system',
      title: '设计系统',
      order: 2,
      required: true,
      contentType: 'text',
      aiPrompt: '建立统一的设计系统和规范',
      subsections: [
        {
          id: 'color_palette',
          title: '色彩系统',
          order: 1,
          contentType: 'text',
          aiPrompt: '定义主色调、辅助色和语义色彩',
        },
        {
          id: 'typography',
          title: '字体系统',
          order: 2,
          contentType: 'text',
          aiPrompt: '定义字体规范和层级结构',
        },
        {
          id: 'spacing_grid',
          title: '间距网格',
          order: 3,
          contentType: 'text',
          aiPrompt: '定义间距系统和网格布局',
        },
      ],
    },
    {
      id: 'component_design',
      title: '组件设计',
      order: 3,
      required: true,
      contentType: 'text',
      aiPrompt: '设计可复用的 UI 组件库',
      subsections: [
        {
          id: 'basic_components',
          title: '基础组件',
          order: 1,
          contentType: 'text',
          aiPrompt: '设计按钮、输入框、标签等基础组件',
        },
        {
          id: 'complex_components',
          title: '复合组件',
          order: 2,
          contentType: 'text',
          aiPrompt: '设计表格、表单、导航等复合组件',
        },
      ],
    },
    {
      id: 'page_layout',
      title: '页面布局',
      order: 4,
      required: true,
      contentType: 'text',
      aiPrompt: '设计主要页面的布局和结构',
      subsections: [
        {
          id: 'layout_structure',
          title: '布局结构',
          order: 1,
          contentType: 'text',
          aiPrompt: '设计页面整体布局和区域划分',
        },
        {
          id: 'responsive_design',
          title: '响应式设计',
          order: 2,
          contentType: 'text',
          aiPrompt: '设计多设备适配和响应式布局',
        },
      ],
    },
    {
      id: 'interaction_design',
      title: '交互设计',
      order: 5,
      required: true,
      contentType: 'diagram',
      aiPrompt: '设计用户交互流程和页面跳转',
      subsections: [
        {
          id: 'user_flow',
          title: '用户流程',
          order: 1,
          contentType: 'diagram',
          aiPrompt: '绘制主要业务流程的用户操作路径',
        },
        {
          id: 'interaction_states',
          title: '交互状态',
          order: 2,
          contentType: 'text',
          aiPrompt: '定义组件的各种交互状态和反馈',
        },
      ],
    },
    {
      id: 'accessibility',
      title: '无障碍设计',
      order: 6,
      required: false,
      contentType: 'text',
      aiPrompt: '制定无障碍设计规范和实现方案',
    },
    {
      id: 'ui_testing',
      title: 'UI 测试',
      order: 7,
      required: false,
      contentType: 'text',
      aiPrompt: '设计 UI 测试策略和自动化方案',
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'AI Document Generator',
    createdAt: new Date('2024-01-01'),
    tags: ['ui', 'design', 'user-experience'],
    estimatedGenerationTime: 120, // 2 分钟
  },
};
