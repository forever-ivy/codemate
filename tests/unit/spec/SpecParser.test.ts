import { describe, it, expect } from 'vitest';
import { SpecParser } from '../../../src/spec/SpecParser.js';

describe('SpecParser', () => {
  describe('parse', () => {
    it('应该解析基本的Spec文档', () => {
      const content = `---
title: 测试规格
description: 这是一个测试规格文档
version: 1.0.0
status: draft
author: test-user
tags: [test]
projectPath: /test
relatedFiles: []
createdAt: '2024-01-01T00:00:00.000Z'
updatedAt: '2024-01-01T00:00:00.000Z'
tasks: []
---

# 测试规格

这是测试内容。`;

      const result = SpecParser.parse(content, 'test-id');

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document!.title).toBe('测试规格');
      expect(result.document!.description).toBe('这是一个测试规格文档');
      expect(result.document!.status).toBe('draft');
      expect(result.document!.content).toBe('\n# 测试规格\n\n这是测试内容。');
    });

    it('应该处理缺少frontmatter的文档', () => {
      const content = '# 简单文档\n\n这是内容。';

      const result = SpecParser.parse(content, 'test-id');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('缺少必需字段: title');
      expect(result.document!.title).toBe('Untitled Spec');
    });

    it('应该处理没有任务的文档', () => {
      const content = `---
title: 无任务文档
description: 这个文档没有任务
---

# 无任务文档

这是内容。`;

      const result = SpecParser.parse(content, 'test-id');

      expect(result.success).toBe(true);
      expect(result.document!.tasks).toHaveLength(0);
      expect(result.warnings).toContain('未找到任务部分，建议添加 "## Tasks" 部分');
    });
  });

  describe('serialize', () => {
    it('应该序列化Spec文档为Markdown', () => {
      const document = {
        id: 'test-id',
        title: '测试文档',
        description: '测试描述',
        version: '1.0.0',
        status: 'draft' as const,
        content: '# 测试文档\n\n这是内容。',
        tasks: [
          {
            id: 'task-1',
            title: '测试任务',
            description: '任务描述',
            status: 'pending' as const,
            priority: 'medium' as const,
            estimate: { hours: 1, confidence: 0.8 },
            dependencies: [],
            tags: ['test'],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            notes: '',
          },
        ],
        metadata: {
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          author: 'test-user',
          tags: ['test'],
          projectPath: '/test',
          relatedFiles: [],
        },
      };

      const result = SpecParser.serialize(document);

      // 验证frontmatter包含基本信息
      expect(result).toContain('title: 测试文档');
      expect(result).toContain('description: 测试描述');

      // 验证任务存储在frontmatter中
      expect(result).toContain('tasks:');
      expect(result).toContain('title: 测试任务');

      // 验证内容部分
      expect(result).toContain('# 测试文档');
      expect(result).toContain('这是内容。');
    });
  });
});
