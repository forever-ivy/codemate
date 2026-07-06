/**
 * 消息分离系统单元测试
 */
import { describe, it, expect } from 'vitest';
import { splitMessages, pairToolsWithResults } from '../../../src/ui/utils/messageSplitter';
import type { EnhancedMessage } from '../../../src/types/index';

describe('messageSplitter', () => {
  describe('splitMessages', () => {
    it('should return all messages as completed when no tool_use found', () => {
      const messages: EnhancedMessage[] = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: 'Hi there!',
          timestamp: Date.now(),
        },
      ];

      const result = splitMessages(messages);

      expect(result.completedMessages).toEqual(messages);
      expect(result.pendingMessages).toEqual([]);
    });

    it('should split messages when tool_use is found but not completed', () => {
      const messages: EnhancedMessage[] = [
        {
          role: 'user',
          content: 'Do something',
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will help you' },
            { type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'ls' } },
          ],
          timestamp: Date.now(),
        },
      ];

      const result = splitMessages(messages);

      expect(result.completedMessages).toEqual([messages[0]]);
      expect(result.pendingMessages).toEqual([messages[1]]);
    });

    it('should return all messages as completed when all tools are completed', () => {
      const messages: EnhancedMessage[] = [
        {
          role: 'user',
          content: 'List files',
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will list the files' },
            { type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'ls' } },
          ],
          timestamp: Date.now(),
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              id: 'tool-1',
              result: { isError: false, llmContent: 'file1.txt\nfile2.txt' },
            },
          ],
          timestamp: Date.now(),
        },
      ];

      const result = splitMessages(messages);

      expect(result.completedMessages).toEqual(messages);
      expect(result.pendingMessages).toEqual([]);
    });

    it('should handle multiple tool_use in same message', () => {
      const messages: EnhancedMessage[] = [
        {
          role: 'user',
          content: 'Do multiple things',
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'ls' } },
            { type: 'tool_use', id: 'tool-2', name: 'read', input: { file: 'test.txt' } },
          ],
          timestamp: Date.now(),
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              id: 'tool-1',
              result: { isError: false, llmContent: 'file1.txt' },
            },
          ],
          timestamp: Date.now(),
        },
      ];

      const result = splitMessages(messages);

      // Only tool-1 completed, tool-2 still pending
      expect(result.completedMessages).toEqual([messages[0]]);
      expect(result.pendingMessages).toEqual([messages[1], messages[2]]);
    });

    it('should handle legacy tool result format', () => {
      const messages: EnhancedMessage[] = [
        {
          role: 'user',
          content: 'Test command',
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'echo test' } },
          ],
          timestamp: Date.now(),
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              id: 'tool-1',
              result: { isError: false, llmContent: 'test' },
            },
          ],
          timestamp: Date.now(),
          isToolResult: true,
        } as any,
      ];

      const result = splitMessages(messages);

      expect(result.completedMessages).toEqual(messages);
      expect(result.pendingMessages).toEqual([]);
    });
  });

  describe('pairToolsWithResults', () => {
    it('should pair tool_use with corresponding tool_result', () => {
      const assistantMsg: EnhancedMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Running command' },
          { type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'ls' } },
        ],
        timestamp: Date.now(),
      };

      const subsequentMessages: EnhancedMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              id: 'tool-1',
              result: { isError: false, llmContent: 'file1.txt' },
            },
          ],
          timestamp: Date.now(),
        },
      ];

      const pairs = pairToolsWithResults(assistantMsg, subsequentMessages);

      expect(pairs).toHaveLength(1);
      expect(pairs[0].toolUse.id).toBe('tool-1');
      expect(pairs[0].toolResult.id).toBe('tool-1');
    });

    it('should handle unpaired tool_use (no result yet)', () => {
      const assistantMsg: EnhancedMessage = {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'ls' } }],
        timestamp: Date.now(),
      };

      const subsequentMessages: EnhancedMessage[] = [];

      const pairs = pairToolsWithResults(assistantMsg, subsequentMessages);

      expect(pairs).toHaveLength(1);
      expect(pairs[0].toolUse.id).toBe('tool-1');
      expect(pairs[0].toolResult).toBeUndefined();
    });

    it('should handle multiple tool pairs', () => {
      const assistantMsg: EnhancedMessage = {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'ls' } },
          { type: 'tool_use', id: 'tool-2', name: 'read', input: { file: 'test.txt' } },
        ],
        timestamp: Date.now(),
      };

      const subsequentMessages: EnhancedMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              id: 'tool-1',
              result: { isError: false, llmContent: 'file1.txt' },
            },
            {
              type: 'tool_result',
              id: 'tool-2',
              result: { isError: false, llmContent: 'file content' },
            },
          ],
          timestamp: Date.now(),
        },
      ];

      const pairs = pairToolsWithResults(assistantMsg, subsequentMessages);

      expect(pairs).toHaveLength(2);
      expect(pairs[0].toolUse.id).toBe('tool-1');
      expect(pairs[0].toolResult.id).toBe('tool-1');
      expect(pairs[1].toolUse.id).toBe('tool-2');
      expect(pairs[1].toolResult.id).toBe('tool-2');
    });

    it('should return empty array for string content', () => {
      const assistantMsg: EnhancedMessage = {
        role: 'assistant',
        content: 'Just a text message',
        timestamp: Date.now(),
      };

      const pairs = pairToolsWithResults(assistantMsg, []);

      expect(pairs).toEqual([]);
    });
  });
});
