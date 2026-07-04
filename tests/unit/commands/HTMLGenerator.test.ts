import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HTMLGenerator } from '../../../src/commands/log/HTMLGenerator.js';
import { readFile, unlink } from 'fs/promises';

describe('HTMLGenerator', () => {
  let generator: HTMLGenerator;
  let generatedFiles: string[] = [];

  beforeEach(() => {
    generator = new HTMLGenerator();
  });

  afterEach(async () => {
    // 清理生成的文件
    for (const file of generatedFiles) {
      try {
        await unlink(file);
      } catch {
        // 文件可能不存在
      }
    }
    generatedFiles = [];
  });

  it('应该生成有效的 HTML 文件', async () => {
    const logData = {
      sessionPath: '/test/session.jsonl',
      messages: [
        {
          role: 'user' as const,
          content: 'Hello',
          uuid: 'msg-1',
          timestamp: Date.now(),
        },
        {
          role: 'assistant' as const,
          content: 'Hi there!',
          uuid: 'msg-2',
          parentUuid: 'msg-1',
          timestamp: Date.now(),
        },
      ],
      requests: [],
      totalMessages: 2,
      activeMessages: 2,
    };

    const htmlPath = await generator.generateHTML(logData);
    generatedFiles.push(htmlPath);

    expect(htmlPath).toMatch(/\.html$/);

    const htmlContent = await readFile(htmlPath, 'utf-8');

    // 检查 HTML 结构
    expect(htmlContent).toContain('<!DOCTYPE html>');
    expect(htmlContent).toContain('<title>会话日志');
    expect(htmlContent).toContain('Hello');
    expect(htmlContent).toContain('Hi there!');
    expect(htmlContent).toContain('msg-1');
    expect(htmlContent).toContain('msg-2');
  });

  it('应该正确处理工具调用消息', async () => {
    const logData = {
      sessionPath: '/test/session.jsonl',
      messages: [
        {
          role: 'assistant' as const,
          content: [
            {
              type: 'tool_use' as const,
              id: 'tool-1',
              name: 'list_files',
              input: { path: '.' },
            },
          ],
          uuid: 'msg-1',
          timestamp: Date.now(),
        },
      ],
      requests: [],
      totalMessages: 1,
      activeMessages: 1,
    };

    const htmlPath = await generator.generateHTML(logData);
    generatedFiles.push(htmlPath);

    const htmlContent = await readFile(htmlPath, 'utf-8');

    expect(htmlContent).toContain('调用工具: list_files');
  });

  it('应该包含必要的 CSS 和 JavaScript', async () => {
    const logData = {
      sessionPath: '/test/session.jsonl',
      messages: [],
      requests: [],
      totalMessages: 0,
      activeMessages: 0,
    };

    const htmlPath = await generator.generateHTML(logData);
    generatedFiles.push(htmlPath);

    const htmlContent = await readFile(htmlPath, 'utf-8');

    // 检查 CSS
    expect(htmlContent).toContain('<style>');
    expect(htmlContent).toContain('.container');
    expect(htmlContent).toContain('.message-item');

    // 检查 JavaScript
    expect(htmlContent).toContain('<script>');
    expect(htmlContent).toContain('showMessageDetail');
    expect(htmlContent).toContain('const messages =');
  });
});
