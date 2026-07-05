import { describe, expect, it } from 'vitest';
import { MemoryRetrievalService } from '../../../src/memory/MemoryRetrievalService';

describe('MemoryRetrievalService', () => {
  it('should retrieve matching user preferences and project memories for a request', () => {
    const service = new MemoryRetrievalService({
      maxEntries: 3,
    });

    const memory = service.build({
      userMessage: '提交第 74 章之前先运行验证，教程文档要保持一致并推送远端',
      userPreferences: {
        generatedAt: 1,
        filePath: 'memory/user-preferences.json',
        entryCount: 2,
        entries: [
          {
            id: 'up-verify',
            category: 'workflow',
            content: '每章完成后先运行验证，再提交并推送远端。',
            createdAt: 1,
            updatedAt: 2,
          },
          {
            id: 'up-language',
            category: 'communication',
            content: '用户偏好中文沟通。',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        prompt: '',
      },
      projectMemory: {
        generatedAt: 1,
        filePath: '.aicli/memory/project-memory.json',
        entryCount: 2,
        entries: [
          {
            id: 'pm-docs',
            kind: 'convention',
            content: '教程代码和文档必须保持一致。',
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'pm-context',
            kind: 'decision',
            content: 'ContextBuilderService 负责读取文件内容。',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        prompt: '',
      },
    });

    expect(memory.entryCount).toBe(2);
    expect(memory.entries.map((entry) => entry.id)).toEqual(['up-verify', 'pm-docs']);
    expect(memory.prompt).toContain('## Retrieved Memory');
    expect(memory.prompt).toContain(
      '- user-preference/workflow: 每章完成后先运行验证，再提交并推送远端。'
    );
    expect(memory.prompt).toContain('- project/convention: 教程代码和文档必须保持一致。');
    expect(memory.prompt).not.toContain('ContextBuilderService 负责读取文件内容');
  });

  it('should return an empty prompt when no memory matches the request', () => {
    const service = new MemoryRetrievalService();

    const memory = service.build({
      userMessage: '解释一下网络请求超时',
      userPreferences: {
        generatedAt: 1,
        filePath: 'memory/user-preferences.json',
        entryCount: 1,
        entries: [
          {
            id: 'up-language',
            category: 'communication',
            content: '用户偏好中文沟通。',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        prompt: '',
      },
    });

    expect(memory.entryCount).toBe(0);
    expect(memory.entries).toEqual([]);
    expect(memory.prompt).toBe('');
  });
});
