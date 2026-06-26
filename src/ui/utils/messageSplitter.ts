/**
 * 消息分离系统 - 将消息分为已完成和待处理两部分
 */
import type { EnhancedMessage } from '../../types/index';

export interface MessageSplit {
  completedMessages: EnhancedMessage[];
  pendingMessages: EnhancedMessage[];
}

/**
 * 分离消息为已完成和待处理两部分
 */
export function splitMessages(messages: EnhancedMessage[]): MessageSplit {
  // 1. 从末尾找到最后一个包含tool_use的assistant消息
  let lastToolUseIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const hasToolUse = msg.content.some((part: any) => part.type === 'tool_use');
      if (hasToolUse) {
        lastToolUseIndex = i;
        break;
      }
    }
  }

  // 2. 如果没有找到tool_use，所有消息都是已完成的
  if (lastToolUseIndex === -1) {
    return { completedMessages: messages, pendingMessages: [] };
  }

  // 3. 获取最后一个assistant消息中的所有tool_use id
  const assistantMsg = messages[lastToolUseIndex];
  if (typeof assistantMsg.content === 'string') {
    return { completedMessages: messages, pendingMessages: [] };
  }

  const toolUseIds = (assistantMsg.content as any[])
    .filter((p: any) => p.type === 'tool_use')
    .map((p: any) => p.id);

  // 4. 收集这个消息之后的所有tool结果
  const toolResults = new Set<string>();
  for (let i = lastToolUseIndex + 1; i < messages.length; i++) {
    const msg = messages[i];
    // 处理新格式: role: 'tool'
    if (msg.role === ('tool' as const)) {
      const content = msg.content as any[];
      if (Array.isArray(content)) {
        content.forEach((part: any) => {
          if (part.toolCallId) {
            toolResults.add(part.toolCallId);
          }
          if (part.id) {
            toolResults.add(part.id);
          }
        });
      }
    }
    // 处理旧格式: role: 'user' with isToolResult
    else if (msg.role === 'user' && (msg as any).isToolResult) {
      const content = msg.content as any[];
      if (Array.isArray(content) && content[0]) {
        toolResults.add(content[0].id);
      }
    }
  }

  // 5. 检查所有工具是否都已完成
  const allToolsCompleted = toolUseIds.every((id: string) => toolResults.has(id));

  if (allToolsCompleted) {
    return { completedMessages: messages, pendingMessages: [] };
  } else {
    return {
      completedMessages: messages.slice(0, lastToolUseIndex),
      pendingMessages: messages.slice(lastToolUseIndex),
    };
  }
}

/**
 * 将工具使用和结果配对
 */
export function pairToolsWithResults(
  assistantMsg: EnhancedMessage,
  subsequentMessages: EnhancedMessage[]
): Array<{
  toolUse: any;
  toolResult?: any;
}> {
  // 提取所有tool_use部分
  if (typeof assistantMsg.content === 'string') {
    return [];
  }

  const toolUses = (assistantMsg.content as any[]).filter((p: any) => p.type === 'tool_use');

  // 收集所有tool结果，按toolCallId索引
  const resultsMap = new Map<string, any>();
  for (const msg of subsequentMessages) {
    // 处理新格式: role: 'tool'
    if (msg.role === ('tool' as const)) {
      const content = msg.content as any[];
      if (Array.isArray(content)) {
        content.forEach((part: any) => {
          const toolId = part.toolCallId || part.id;
          if (toolId) {
            resultsMap.set(toolId, part);
          }
        });
      }
    }
    // 处理旧格式: role: 'user' with isToolResult
    else if (msg.role === 'user' && (msg as any).isToolResult) {
      const content = msg.content as any[];
      if (Array.isArray(content) && content[0]) {
        const part = content[0];
        resultsMap.set(part.id, part);
      }
    }
  }

  // 将每个tool_use与其结果配对
  return toolUses.map((toolUse: any) => ({
    toolUse,
    toolResult: resultsMap.get(toolUse.id),
  }));
}
