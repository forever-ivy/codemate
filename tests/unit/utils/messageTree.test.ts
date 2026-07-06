import { describe, it, expect } from 'vitest';
import {
  filterMessages,
  cleanUnmatchedToolUse,
  buildMessageTree,
  getAncestors,
} from '../../../src/utils/messageTree';
import type { EnhancedMessage } from '../../../src/types/index';

describe('messageTree', () => {
  /**
   * 测试 1：filterMessages 应该正确过滤活跃路径
   */
  it('should filter active path correctly', () => {
    const messages: EnhancedMessage[] = [
      { uuid: '1', parentUuid: null, role: 'user', content: 'A', timestamp: 1 },
      { uuid: '2', parentUuid: '1', role: 'assistant', content: 'B', timestamp: 2 },
      { uuid: '3', parentUuid: '2', role: 'user', content: 'C', timestamp: 3 },
      { uuid: '4', parentUuid: '3', role: 'assistant', content: 'D', timestamp: 4 },
      { uuid: '5', parentUuid: '2', role: 'user', content: 'E', timestamp: 5 },
      { uuid: '6', parentUuid: '5', role: 'assistant', content: 'F', timestamp: 6 },
    ];

    // 过滤到消息 6
    const filtered = filterMessages(messages, '6');

    expect(filtered).toHaveLength(4);
    expect(filtered.map((m) => m.uuid)).toEqual(['1', '2', '5', '6']);
  });

  /**
   * 测试 2：filterMessages 应该处理默认活跃消息
   */
  it('should use last message as default active', () => {
    const messages: EnhancedMessage[] = [
      { uuid: '1', parentUuid: null, role: 'user', content: 'A', timestamp: 1 },
      { uuid: '2', parentUuid: '1', role: 'assistant', content: 'B', timestamp: 2 },
    ];

    const filtered = filterMessages(messages);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((m) => m.uuid)).toEqual(['1', '2']);
  });

  /**
   * 测试 3：cleanUnmatchedToolUse 应该移除未匹配的 tool_use
   */
  it('should clean unmatched tool_use', () => {
    const messages: EnhancedMessage[] = [
      {
        uuid: '1',
        parentUuid: null,
        role: 'assistant',
        content: [
          { type: 'tool_use', id: '1', name: 'read', input: {} },
          { type: 'tool_use', id: '2', name: 'write', input: {} },
        ],
        timestamp: 1,
      },
      {
        uuid: '2',
        parentUuid: '1',
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: '1', content: 'result' }],
        timestamp: 2,
      },
    ];

    const cleaned = cleanUnmatchedToolUse(messages);

    // tool_use id='2' 应该被移除
    const assistantMessage = cleaned[0];
    expect(assistantMessage.content).toHaveLength(1);
    expect((assistantMessage.content as any)[0].id).toBe('1');
  });

  /**
   * 测试 4：buildMessageTree 应该构建正确的树结构
   */
  it('should build message tree correctly', () => {
    const messages: EnhancedMessage[] = [
      { uuid: '1', parentUuid: null, role: 'user', content: 'A', timestamp: 1 },
      { uuid: '2', parentUuid: '1', role: 'assistant', content: 'B', timestamp: 2 },
      { uuid: '3', parentUuid: '2', role: 'user', content: 'C', timestamp: 3 },
    ];

    const tree = buildMessageTree(messages, '3');

    expect(tree).toHaveLength(1); // 一个根节点
    expect(tree[0].message.uuid).toBe('1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].message.uuid).toBe('2');
  });

  /**
   * 测试 5：getAncestors 应该返回所有祖先
   */
  it('should get all ancestors', () => {
    const messages: EnhancedMessage[] = [
      { uuid: '1', parentUuid: null, role: 'user', content: 'A', timestamp: 1 },
      { uuid: '2', parentUuid: '1', role: 'assistant', content: 'B', timestamp: 2 },
      { uuid: '3', parentUuid: '2', role: 'user', content: 'C', timestamp: 3 },
    ];

    const ancestors = getAncestors(messages, '3');

    expect(ancestors).toHaveLength(2);
    expect(ancestors.map((m) => m.uuid)).toEqual(['1', '2']);
  });
});
