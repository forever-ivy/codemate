import type { DocumentTemplate } from '../types.js';

/**
 * 数据库设计文档模板
 */
export const databaseTemplate: DocumentTemplate = {
  id: 'database_design_v1',
  name: '数据库设计文档',
  type: 'database',
  description: '专注于数据库设计的技术文档模板',
  sections: [
    {
      id: 'database_overview',
      title: '数据库概述',
      order: 1,
      required: true,
      contentType: 'text',
      aiPrompt: '基于 Spec 数据生成数据库设计概述，包括数据库选型、设计原则、性能要求',
    },
    {
      id: 'data_model',
      title: '数据模型',
      order: 2,
      required: true,
      contentType: 'diagram',
      aiPrompt: '设计核心数据模型和实体关系图',
      subsections: [
        {
          id: 'entity_relationship',
          title: '实体关系图',
          order: 1,
          contentType: 'diagram',
          aiPrompt: '绘制实体关系图(ERD)和数据模型',
        },
        {
          id: 'data_dictionary',
          title: '数据字典',
          order: 2,
          contentType: 'table',
          aiPrompt: '整理完整的数据字典和字段说明',
        },
      ],
    },
    {
      id: 'table_design',
      title: '表结构设计',
      order: 3,
      required: true,
      contentType: 'code',
      aiPrompt: '设计详细的数据库表结构和字段定义',
      subsections: [
        {
          id: 'core_tables',
          title: '核心表',
          order: 1,
          contentType: 'code',
          aiPrompt: '设计系统核心业务表结构',
        },
        {
          id: 'lookup_tables',
          title: '字典表',
          order: 2,
          contentType: 'code',
          aiPrompt: '设计系统字典和配置表结构',
        },
        {
          id: 'audit_tables',
          title: '审计表',
          order: 3,
          contentType: 'code',
          aiPrompt: '设计审计日志和历史记录表',
        },
      ],
    },
    {
      id: 'index_design',
      title: '索引设计',
      order: 4,
      required: true,
      contentType: 'text',
      aiPrompt: '制定数据库索引策略和优化方案',
      subsections: [
        {
          id: 'primary_indexes',
          title: '主键索引',
          order: 1,
          contentType: 'text',
          aiPrompt: '设计主键索引策略',
        },
        {
          id: 'secondary_indexes',
          title: '辅助索引',
          order: 2,
          contentType: 'text',
          aiPrompt: '设计辅助索引和复合索引',
        },
      ],
    },
    {
      id: 'data_migration',
      title: '数据迁移',
      order: 5,
      required: true,
      contentType: 'code',
      aiPrompt: '设计数据迁移脚本和策略',
      subsections: [
        {
          id: 'migration_scripts',
          title: '迁移脚本',
          order: 1,
          contentType: 'code',
          aiPrompt: '编写数据库迁移和版本管理脚本',
        },
        {
          id: 'data_seeding',
          title: '数据初始化',
          order: 2,
          contentType: 'code',
          aiPrompt: '设计初始数据和测试数据脚本',
        },
      ],
    },
    {
      id: 'performance_optimization',
      title: '性能优化',
      order: 6,
      required: false,
      contentType: 'text',
      aiPrompt: '制定数据库性能优化策略',
    },
    {
      id: 'backup_recovery',
      title: '备份恢复',
      order: 7,
      required: false,
      contentType: 'text',
      aiPrompt: '设计数据备份和灾难恢复方案',
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'AI Document Generator',
    createdAt: new Date('2024-01-01'),
    tags: ['database', 'data-model', 'schema'],
    estimatedGenerationTime: 150, // 2.5 分钟
  },
};
