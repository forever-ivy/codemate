import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentExporter } from '../../../src/spec/design/DocumentExporter.js';
import type { DesignDocument } from '../../../src/spec/design/types.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe('DocumentExporter', () => {
  let exporter: DocumentExporter;
  let mockDocument: DesignDocument;

  beforeEach(() => {
    exporter = new DocumentExporter();

    mockDocument = {
      id: 'doc-123',
      specId: 'spec-123',
      type: 'complete',
      title: '用户认证系统 - 技术设计文档',
      content: {
        sections: [
          {
            id: 'overview',
            title: '项目概述',
            content:
              '这是一个用户认证系统的技术设计文档。\n\n系统主要包括用户注册、登录、权限管理等功能。',
            metadata: {
              generatedAt: new Date(),
              generationTime: 1000,
              wordCount: 50,
              quality: 0.8,
            },
          },
          {
            id: 'architecture',
            title: '系统架构',
            content: '## 整体架构\n\n系统采用分层架构设计，包括：\n- 表现层\n- 业务层\n- 数据层',
            metadata: {
              generatedAt: new Date(),
              generationTime: 1500,
              wordCount: 30,
              quality: 0.9,
            },
          },
        ],
        metadata: {
          generatedAt: new Date(),
          analysisData: {
            specId: 'spec-123',
            summary: {
              projectType: 'Web Application',
              complexity: 'medium',
              mainFeatures: ['认证', '授权'],
              technicalHighlights: ['REST API', '数据库'],
            },
          },
          generationStats: {
            totalSections: 2,
            generatedSections: 2,
            failedSections: 0,
            totalGenerationTime: 2500,
            averageQuality: 0.85,
          },
        },
      },
      metadata: {
        templateId: 'complete_tech_doc_v1',
        generatedBy: 'ai',
        generationOptions: {
          detailLevel: 'detailed',
          language: 'zh',
        },
        specVersion: '1.0.0',
        wordCount: 80,
        estimatedReadTime: 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  it('应该能导出Markdown格式', async () => {
    const results = await exporter.exportDocument(mockDocument, ['markdown'], {
      outputDir: './test-output',
      includeMetadata: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].format).toBe('markdown');
    expect(results[0].success).toBe(true);
    expect(results[0].filename).toContain('.md');
  });

  it('应该能导出HTML格式', async () => {
    const results = await exporter.exportDocument(mockDocument, ['html'], {
      outputDir: './test-output',
      includeMetadata: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].format).toBe('html');
    expect(results[0].success).toBe(true);
    expect(results[0].filename).toContain('.html');
  });

  it('应该能导出PDF格式', async () => {
    const results = await exporter.exportDocument(mockDocument, ['pdf'], {
      outputDir: './test-output',
      includeMetadata: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].format).toBe('pdf');
    expect(results[0].success).toBe(true);
    expect(results[0].filename).toContain('.pdf');
  });

  it('应该能同时导出多种格式', async () => {
    const results = await exporter.exportDocument(mockDocument, ['markdown', 'html', 'pdf'], {
      outputDir: './test-output',
      includeMetadata: true,
    });

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);

    const formats = results.map((r) => r.format);
    expect(formats).toContain('markdown');
    expect(formats).toContain('html');
    expect(formats).toContain('pdf');
  });

  it('应该支持自定义文件名', async () => {
    const results = await exporter.exportDocument(mockDocument, ['markdown'], {
      outputDir: './test-output',
      filename: 'custom-document',
      includeMetadata: true,
    });

    expect(results[0].filename).toBe('custom-document.md');
  });

  it('应该处理导出错误', async () => {
    // Mock writeFile to throw error
    const { writeFile } = await import('fs/promises');
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('Write failed'));

    const results = await exporter.exportDocument(mockDocument, ['markdown'], {
      outputDir: './test-output',
      includeMetadata: true,
    });

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Write failed');
  });

  it('应该生成正确的文件大小信息', async () => {
    const results = await exporter.exportDocument(mockDocument, ['markdown'], {
      outputDir: './test-output',
      includeMetadata: true,
    });

    expect(results[0].size).toBeGreaterThan(0);
    expect(typeof results[0].size).toBe('number');
  });

  it('应该处理不支持的导出格式', async () => {
    const results = await exporter.exportDocument(mockDocument, ['unsupported' as any], {
      outputDir: './test-output',
      includeMetadata: true,
    });

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('不支持的导出格式');
  });
});
