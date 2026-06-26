/**
 * AI任务执行跟踪系统 - 工具函数
 */
import type { EnhancedMessage } from '../../../types/index';
import type { LogItem, TaskStats, ToolUsePart, ToolResultPart } from './types';

/**
 * 计算任务统计信息
 */
export function calculateStats(messages: EnhancedMessage[]): TaskStats {
  let toolCalls = 0;
  let tokens = 0;

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      // 计算工具调用次数
      if (Array.isArray(msg.content)) {
        toolCalls += msg.content.filter((p: any) => p.type === 'tool_use').length;
      }

      // 计算token使用量（如果有usage信息）
      if ('usage' in msg && msg.usage) {
        tokens += (msg.usage as any).input_tokens + (msg.usage as any).output_tokens;
      }
    }
  }

  return { toolCalls, tokens };
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * 格式化token数量
 */
export function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count > 1000000) {
    return `${(count / 1000000).toFixed(2)}M`;
  }
  return `${(count / 1000).toFixed(1)}k`;
}

/**
 * 将消息分组为LogItems
 */
export function groupMessages(messages: EnhancedMessage[]): LogItem[] {
  const items: LogItem[] = [];
  const toolUseMap = new Map<string, LogItem & { type: 'tool' }>();

  for (const [messageIndex, msg] of messages.entries()) {
    if (msg.role === 'user') {
      let content = '...';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        const textPart = msg.content.find((p: any) => p.type === 'text');
        if (textPart && textPart.type === 'text') {
          content = textPart.text;
        }
      }

      items.push({
        type: 'user',
        content,
        id: (msg as any).uuid || `user-${messageIndex}`,
      });
    } else if (msg.role === 'assistant') {
      const content = msg.content;
      if (typeof content === 'string') {
        items.push({
          type: 'text',
          content,
          id: (msg as any).uuid || `text-${messageIndex}`,
        });
      } else if (Array.isArray(content)) {
        for (const [partIndex, part] of content.entries()) {
          if (part.type === 'text') {
            const id = (msg as any).uuid
              ? `${(msg as any).uuid}-text-${partIndex}`
              : `text-${messageIndex}-${partIndex}`;
            items.push({
              type: 'text',
              content: part.text,
              id,
            });
          } else if (part.type === 'tool_use') {
            const item: LogItem & { type: 'tool' } = {
              type: 'tool',
              toolUse: part as ToolUsePart,
              id: part.id,
            };
            items.push(item);
            toolUseMap.set(part.id, item);
          }
        }
      }
    } else if (msg.role === 'tool') {
      const content = msg.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          // 检查part是否有tool_use_id属性（tool result的特征）
          if ('tool_use_id' in part) {
            const toolId = part.tool_use_id;
            if (toolId) {
              const toolUseItem = toolUseMap.get(toolId);
              if (toolUseItem) {
                toolUseItem.toolResult = part as ToolResultPart;
              }
            }
          }
        }
      }
    }
  }

  return items;
}
