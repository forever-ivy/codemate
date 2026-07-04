import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LogParser } from '../../../src/commands/log/LogParser.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import * as pathe from 'pathe';
import { tmpdir } from 'os';

describe('LogParser', () => {
  let parser: LogParser;
  let tempDir: string;
  let sessionFile: string;
  let requestFile: string;

  beforeEach(async () => {
    parser = new LogParser();
    tempDir = pathe.join(tmpdir(), `log-parser-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    sessionFile = pathe.join(tempDir, 'test-session.jsonl');
    requestFile = pathe.join(tempDir, 'test-session.requests.jsonl');
  });

  afterEach(async () => {
    try {
      await unlink(sessionFile);
      await unlink(requestFile);
    } catch {
      // 文件可能不存在
    }
  });

  it('应该正确解析简单的会话文件', async () => {
    const messages = [
      {
        role: 'user',
        content: 'Hello',
        uuid: 'msg-1',
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content: 'Hi there!',
        uuid: 'msg-2',
        parentUuid: 'msg-1',
        timestamp: Date.now(),
      },
    ];

    const jsonl = messages.map((msg) => JSON.stringify(msg)).join('\n');
    await writeFile(sessionFile, jsonl);

    const result = await parser.parseLogFile(sessionFile);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.activeMessages).toBe(2);
  });

  it('应该正确过滤活跃消息', async () => {
    const messages = [
      {
        role: 'user',
        content: 'Hello',
        uuid: 'msg-1',
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content: 'Hi there!',
        uuid: 'msg-2',
        parentUuid: 'msg-1',
        timestamp: Date.now(),
      },
      {
        role: 'user',
        content: 'How are you?',
        uuid: 'msg-3',
        parentUuid: 'msg-1', // 分叉点
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content: 'I am fine!',
        uuid: 'msg-4',
        parentUuid: 'msg-3',
        timestamp: Date.now(),
      },
    ];

    const jsonl = messages.map((msg) => JSON.stringify(msg)).join('\n');
    await writeFile(sessionFile, jsonl);

    const result = await parser.parseLogFile(sessionFile);

    // 应该只包含活跃路径: msg-1 -> msg-3 -> msg-4
    expect(result.messages).toHaveLength(3);
    expect(result.messages.map((m) => m.uuid)).toEqual(['msg-1', 'msg-3', 'msg-4']);
    expect(result.totalMessages).toBe(4);
    expect(result.activeMessages).toBe(3);
  });

  it('应该处理工具调用消息', async () => {
    const messages = [
      {
        role: 'user',
        content: 'List files',
        uuid: 'msg-1',
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'list_files',
            input: { path: '.' },
          },
        ],
        uuid: 'msg-2',
        parentUuid: 'msg-1',
        timestamp: Date.now(),
      },
      {
        role: 'tool',
        content: 'file1.txt\nfile2.txt',
        uuid: 'msg-3',
        parentUuid: 'msg-2',
        timestamp: Date.now(),
      },
    ];

    const jsonl = messages.map((msg) => JSON.stringify(msg)).join('\n');
    await writeFile(sessionFile, jsonl);

    const result = await parser.parseLogFile(sessionFile);

    expect(result.messages).toHaveLength(3);
    expect(result.messages[1].content).toBeInstanceOf(Array);
    expect(result.messages[2].role).toBe('tool');
  });

  it('应该处理格式错误的行', async () => {
    const content = `
{"role":"user","content":"Hello","uuid":"msg-1","timestamp":${Date.now()}}
invalid json line
{"role":"assistant","content":"Hi","uuid":"msg-2","parentUuid":"msg-1","timestamp":${Date.now()}}
    `.trim();

    await writeFile(sessionFile, content);

    const result = await parser.parseLogFile(sessionFile);

    // 应该跳过无效行，只解析有效的消息
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
  });

  it('应该处理不存在的请求文件', async () => {
    const messages = [
      {
        role: 'user',
        content: 'Hello',
        uuid: 'msg-1',
        timestamp: Date.now(),
      },
    ];

    const jsonl = messages.map((msg) => JSON.stringify(msg)).join('\n');
    await writeFile(sessionFile, jsonl);

    // 不创建请求文件
    const result = await parser.parseLogFile(sessionFile);

    expect(result.messages).toHaveLength(1);
    expect(result.requests).toHaveLength(0);
  });
});
