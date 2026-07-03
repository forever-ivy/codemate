import { describe, it, expect, beforeEach } from 'vitest';
import { DesignDocumentGenerator } from '../../src/spec/design/DesignDocumentGenerator.js';
import { DocumentExporter } from '../../src/spec/design/DocumentExporter.js';
import { DocumentTemplateManager } from '../../src/spec/design/DocumentTemplateManager.js';
import { EventBus } from '../../src/services/EventBus.js';
import type { ModelService } from '../../src/services/ModelService.js';
import type { SpecDocument } from '../../src/spec/types.js';

describe('Design System Integration', () => {
  let generator: DesignDocumentGenerator;
  let exporter: DocumentExporter;
  let templateManager: DocumentTemplateManager;
  let eventBus: EventBus;
  let mockModelService: ModelService;
  let mockSpec: SpecDocument;

  beforeEach(() => {
    eventBus = new EventBus();

    mockModelService = {
      chat: async () => ({
        content: JSON.stringify({
          projectType: 'Web Application',
          complexity: 'medium',
          mainFeatures: ['用户管理', '权限控制', '数据处理'],
          technicalHighlights: ['RESTful API', '数据库设计', '前端框架'],
        }),
      }),
    } as any;

    generator = new DesignDocumentGenerator(eventBus, mockModelService);
    exporter = new DocumentExporter();
    templateManager = new DocumentTemplateManager();

    mockSpec = {
      id: 'integration-test-spec',
      title: '集成测试项目',
      description: '用于测试设计文档生成的完整项目',
      status: 'completed',
      version: '1.0.0',
      tasks: [
        {
          id: 'task-1',
          title: '核心功能实现',
          description: '实现系统核心业务功能',
          status: 'completed',
          priority: 'high',
          estimatedHours: 16,
          assignee: 'developer',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          title: 'API接口开发',
          description: '开发RESTful API接口',
          status: 'completed',
          priority: 'high',
          estimatedHours: 12,
          assignee: 'developer',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-3',
          title: '数据库设计',
          description: '设计数据库表结构和关系',
          status: 'completed',
          priority: 'medium',
          estimatedHours: 8,
          assignee: 'developer',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  });

  it('应该能完整生成和导出设计文档', async () => {
    // 生成文档
    const document = await generator.generate(mockSpec, {
      type: 'complete',
      options: {
        detailLevel: 'detailed',
        language: 'zh',
        style: 'technical',
        includeCodeExamples: true,
        includeDiagrams: true,
      },
    });

    expect(document).toBeDefined();
    expect(document.specId).toBe(mockSpec.id);
    expect(document.type).toBe('complete');
    expect(document.content.sections.length).toBeGreaterThan(0);
    expect(document.metadata.wordCount).toBeGreaterThan(0);

    // 导出文档
    const exportResults = await exporter.exportDocument(document, ['markdown', 'html'], {
      outputDir: './test-output',
      includeMetadata: true,
    });

    expect(exportResults).toHaveLength(2);
    expect(exportResults.every((r) => r.success)).toBe(true);

    const markdownResult = exportResults.find((r) => r.format === 'markdown');
    const htmlResult = exportResults.find((r) => r.format === 'html');

    expect(markdownResult).toBeDefined();
    expect(htmlResult).toBeDefined();
    expect(markdownResult!.size).toBeGreaterThan(0);
    expect(htmlResult!.size).toBeGreaterThan(0);
  });

  it('应该能生成不同类型的设计文档', async () => {
    const documentTypes = ['architecture', 'api', 'database', 'ui', 'testing'] as const;

    for (const type of documentTypes) {
      const document = await generator.generate(mockSpec, {
        type,
        options: {
          detailLevel: 'detailed',
          language: 'zh',
        },
      });

      expect(document.type).toBe(type);
      expect(document.title).toContain(mockSpec.title);
      expect(document.content.sections.length).toBeGreaterThan(0);
    }
  });

  it('应该能处理模板管理', async () => {
    // 获取所有模板
    const templates = templateManager.listTemplates();
    expect(templates.length).toBeGreaterThan(0);

    // 获取特定模板
    const completeTemplate = await templateManager.getTemplate('complete');
    expect(completeTemplate).toBeDefined();
    expect(completeTemplate.type).toBe('complete');
    expect(completeTemplate.sections.length).toBeGreaterThan(0);

    // 验证模板
    const isValid = templateManager.validateTemplate(completeTemplate);
    expect(isValid).toBe(true);
  });

  it('应该能处理事件系统', async () => {
    const events: string[] = [];

    eventBus.on('document_generation_started', () => {
      events.push('started');
    });

    eventBus.on('document_generation_completed', () => {
      events.push('completed');
    });

    await generator.generate(mockSpec, {
      type: 'complete',
      options: {
        detailLevel: 'brief',
      },
    });

    expect(events).toContain('started');
    expect(events).toContain('completed');
  });

  it('应该能处理生成错误并提供备用方案', async () => {
    // Mock AI service to fail
    const failingModelService = {
      chat: async () => {
        throw new Error('AI service unavailable');
      },
    } as any;

    const failingGenerator = new DesignDocumentGenerator(eventBus, failingModelService);

    // 应该仍然能生成文档（使用备用分析）
    const document = await failingGenerator.generate(mockSpec, {
      type: 'complete',
      options: {
        detailLevel: 'detailed',
      },
    });

    expect(document).toBeDefined();
    expect(document.content.sections.length).toBeGreaterThan(0);
  });

  it('应该能处理大型项目的文档生成', async () => {
    // 创建大型项目 Spec
    const largeSpec = {
      ...mockSpec,
      id: 'large-project-spec',
      title: '大型企业级系统',
      tasks: Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i + 1}`,
        title: `功能模块 ${i + 1}`,
        description: `第 ${i + 1} 个功能模块的详细实现`,
        status: 'completed',
        priority: 'medium',
        estimatedHours: 8,
        assignee: 'developer',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };

    const startTime = Date.now();

    const document = await generator.generate(largeSpec, {
      type: 'complete',
      options: {
        detailLevel: 'comprehensive',
        language: 'zh',
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(document).toBeDefined();
    expect(document.metadata.wordCount).toBeGreaterThan(1000);
    expect(duration).toBeLessThan(30000); // 应该在30秒内完成
  });
});
