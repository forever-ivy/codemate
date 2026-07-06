import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DesignDocumentGenerator } from '../../../src/spec/design/DesignDocumentGenerator.js';
import type { EventBus } from '../../../src/services/EventBus.js';
import type { ModelService } from '../../../src/services/ModelService.js';
import type { SpecDocument } from '../../../src/spec/types.js';

describe('DesignDocumentGenerator', () => {
  let generator: DesignDocumentGenerator;
  let mockEventBus: EventBus;
  let mockModelService: ModelService;
  let mockSpec: SpecDocument;

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as any;

    mockModelService = {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Web Application',
          complexity: 'medium',
          mainFeatures: ['用户认证', '权限管理', '数据管理'],
          technicalHighlights: ['RESTful API', '数据库设计', '安全认证'],
        }),
      }),
    } as any;

    mockSpec = {
      id: 'spec-123',
      title: '用户认证系统',
      description: '实现用户注册、登录、权限管理功能',
      status: 'completed',
      version: '1.0.0',
      tasks: [
        {
          id: 'task-1',
          title: '用户注册功能',
          description: '实现用户注册接口',
          status: 'completed',
          priority: 'high',
          estimatedHours: 8,
          assignee: 'developer',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          title: '用户登录功能',
          description: '实现用户登录认证',
          status: 'completed',
          priority: 'high',
          estimatedHours: 6,
          assignee: 'developer',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    generator = new DesignDocumentGenerator(mockEventBus, mockModelService);
  });

  it('应该能生成完整技术文档', async () => {
    const request = {
      type: 'complete' as const,
      options: {
        detailLevel: 'detailed' as const,
        language: 'zh' as const,
        style: 'technical' as const,
      },
    };

    const document = await generator.generate(mockSpec, request);

    expect(document).toBeDefined();
    expect(document.specId).toBe(mockSpec.id);
    expect(document.type).toBe('complete');
    expect(document.title).toContain('用户认证系统');
    expect(document.content.sections.length).toBeGreaterThan(0);
    expect(document.metadata.wordCount).toBeGreaterThan(0);
    expect(document.metadata.estimatedReadTime).toBeGreaterThan(0);
  });

  it('应该能生成架构设计文档', async () => {
    const request = {
      type: 'architecture' as const,
      options: {
        detailLevel: 'detailed' as const,
      },
    };

    const document = await generator.generate(mockSpec, request);

    expect(document.type).toBe('architecture');
    expect(document.title).toContain('架构设计文档');
  });

  it('应该能生成API设计文档', async () => {
    const request = {
      type: 'api' as const,
      options: {
        includeCodeExamples: true,
      },
    };

    const document = await generator.generate(mockSpec, request);

    expect(document.type).toBe('api');
    expect(document.title).toContain('API 设计文档');
  });

  it('应该发送生成事件', async () => {
    const request = {
      type: 'complete' as const,
      options: {},
    };

    await generator.generate(mockSpec, request);

    expect(mockEventBus.emit).toHaveBeenCalledWith('document_generation_started', {
      specId: mockSpec.id,
      type: 'complete',
    });

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'document_generation_completed',
      expect.objectContaining({
        specId: mockSpec.id,
        type: 'complete',
      })
    );
  });

  it('应该处理AI服务失败的情况', async () => {
    mockModelService.chat = vi.fn().mockRejectedValue(new Error('AI service error'));

    const request = {
      type: 'complete' as const,
      options: {},
    };

    const document = await generator.generate(mockSpec, request);

    // 应该使用备用分析结果
    expect(document).toBeDefined();
    expect(document.content.sections.length).toBeGreaterThan(0);
  });

  it('应该正确计算文档统计信息', async () => {
    const request = {
      type: 'complete' as const,
      options: {
        detailLevel: 'comprehensive' as const,
      },
    };

    const document = await generator.generate(mockSpec, request);

    expect(document.metadata.wordCount).toBeGreaterThan(0);
    expect(document.metadata.estimatedReadTime).toBeGreaterThan(0);
    expect(document.metadata.generatedBy).toBe('ai');
    expect(document.metadata.specVersion).toBe(mockSpec.version);
  });

  it('应该支持自定义生成选项', async () => {
    const request = {
      type: 'complete' as const,
      options: {
        detailLevel: 'brief' as const,
        language: 'en' as const,
        style: 'casual' as const,
        includeCodeExamples: false,
        includeDiagrams: false,
      },
    };

    const document = await generator.generate(mockSpec, request);

    expect(document.metadata.generationOptions).toEqual(request.options);
  });
});
