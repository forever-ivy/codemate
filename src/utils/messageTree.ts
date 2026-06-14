import { v4 as uuidv4 } from 'uuid';
import type { EnhancedMessage, MessageTreeNode } from '../types/index';

/**
 * 过滤活跃路径上的消息
 *
 * 这是会话分叉的核心函数
 *
 * @param messages 所有消息
 * @param activeMessageUuid 活跃消息 UUID（可选，默认为最后一条）
 * @returns 活跃路径上的消息
 */
export function filterMessages(
  messages: EnhancedMessage[],
  activeMessageUuid?: string
): EnhancedMessage[] {
  if (messages.length === 0) {
    return [];
  }

  // 1. 确定目标消息
  const targetUuid = activeMessageUuid || messages[messages.length - 1]?.uuid;
  if (!targetUuid) {
    return messages;
  }

  // 2. 构建消息映射（优化查找性能）
  const messageMap = new Map<string, EnhancedMessage>();
  for (const message of messages) {
    messageMap.set(message.uuid, message);
  }

  // 3. 从目标消息向上追溯
  const activePath = new Set<string>();
  let currentUuid: string | null = targetUuid;

  while (currentUuid) {
    activePath.add(currentUuid);
    const message = messageMap.get(currentUuid);
    currentUuid = message?.parentUuid || null;
  }

  // 4. 过滤并保持原始顺序
  return messages.filter((m) => activePath.has(m.uuid));
}

/**
 * 清理未匹配的 tool_use
 *
 * 确保每个 tool_use 都有对应的 tool_result
 *
 * @param messages 消息列表
 * @returns 清理后的消息列表
 */
export function cleanUnmatchedToolUse(messages: EnhancedMessage[]): EnhancedMessage[] {
  // 1. 收集所有 tool_use 和 tool_result 的 ID
  const toolUseIds = new Set<string>();
  const toolResultIds = new Set<string>();

  for (const message of messages) {
    const content = message.content;

    // 跳过文本消息
    if (typeof content === 'string') {
      continue;
    }

    // 收集 tool_use ID
    if (message.role === 'assistant') {
      for (const block of content) {
        if (block.type === 'tool_use') {
          toolUseIds.add(block.id);
        }
      }
    }

    // 收集 tool_result ID
    if (message.role === 'user') {
      for (const block of content) {
        if (block.type === 'tool_result') {
          toolResultIds.add(block.tool_use_id);
        }
      }
    }
  }

  // 2. 找出未匹配的 tool_use
  const unmatchedIds = new Set([...toolUseIds].filter((id) => !toolResultIds.has(id)));

  // 3. 如果没有未匹配的，直接返回
  if (unmatchedIds.size === 0) {
    return messages;
  }

  // 4. 移除未匹配的 tool_use
  return messages.map((message) => {
    const content = message.content;

    // 跳过文本消息
    if (typeof content === 'string') {
      return message;
    }

    // 只处理 assistant 消息
    if (message.role !== 'assistant') {
      return message;
    }

    // 过滤掉未匹配的 tool_use
    const filteredContent = content.filter(
      (block) => block.type !== 'tool_use' || !unmatchedIds.has(block.id)
    );

    // 如果内容没有变化，返回原消息
    if (filteredContent.length === content.length) {
      return message;
    }

    // 返回新消息
    return {
      ...message,
      content: filteredContent,
    };
  });
}

/**
 * 生成新的消息 UUID
 *
 * 使用 uuid v4 生成唯一标识
 */
export function generateMessageUuid(): string {
  return uuidv4();
}

/**
 * 构建消息树
 *
 * 将平面消息列表转换为树形结构
 *
 * @param messages 消息列表
 * @param activeMessageUuid 活跃消息 UUID
 * @returns 消息树根节点列表
 */
export function buildMessageTree(
  messages: EnhancedMessage[],
  activeMessageUuid?: string
): MessageTreeNode[] {
  // 1. 构建消息映射
  const messageMap = new Map<string, EnhancedMessage>();
  for (const message of messages) {
    messageMap.set(message.uuid, message);
  }

  // 2. 确定活跃路径
  const activePath = new Set<string>();
  if (activeMessageUuid) {
    let currentUuid: string | null = activeMessageUuid;
    while (currentUuid) {
      activePath.add(currentUuid);
      const message = messageMap.get(currentUuid);
      currentUuid = message?.parentUuid || null;
    }
  }

  // 3. 构建树节点
  const nodeMap = new Map<string, MessageTreeNode>();
  for (const message of messages) {
    nodeMap.set(message.uuid, {
      message,
      children: [],
      depth: 0,
      isActive: activePath.has(message.uuid),
    });
  }

  // 4. 建立父子关系
  const roots: MessageTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.message.parentUuid === null) {
      // 根节点
      roots.push(node);
    } else {
      // 子节点
      const parent = nodeMap.get(node.message.parentUuid);
      if (parent) {
        parent.children.push(node);
        node.depth = parent.depth + 1;
      }
    }
  }

  return roots;
}

/**
 * 获取消息的所有祖先
 *
 * @param messages 消息列表
 * @param messageUuid 消息 UUID
 * @returns 祖先消息列表（从根到父）
 */
export function getAncestors(messages: EnhancedMessage[], messageUuid: string): EnhancedMessage[] {
  const messageMap = new Map<string, EnhancedMessage>();
  for (const message of messages) {
    messageMap.set(message.uuid, message);
  }

  const ancestors: EnhancedMessage[] = [];
  let currentUuid: string | null = messageUuid;

  while (currentUuid) {
    const message = messageMap.get(currentUuid);
    if (!message) break;

    if (message.parentUuid) {
      const parent = messageMap.get(message.parentUuid);
      if (parent) {
        ancestors.unshift(parent); // 添加到开头
      }
    }

    currentUuid = message.parentUuid;
  }

  return ancestors;
}
