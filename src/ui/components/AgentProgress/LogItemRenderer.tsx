/**
 * 日志项渲染器 - 渲染单个LogItem
 */
import React from 'react';
import { Box, Text } from 'ink';
import type { LogItem, ToolResultPart } from './types';
import { useAppContext } from '../../context/AppContext';

interface LogItemRendererProps {
  item: LogItem;
}

/**
 * 从工具结果中提取文本
 */
function parseToolResult(resultPart: ToolResultPart): {
  isError: boolean;
  returnDisplay?: any;
  llmContent?: any;
} {
  const fallback = {
    isError: resultPart.is_error ?? false,
    llmContent: resultPart.content,
  };

  try {
    const parsed = JSON.parse(resultPart.content);
    if (parsed && typeof parsed === 'object') {
      const result = (parsed as any).result ?? parsed;
      return {
        isError: result.isError ?? result.is_error ?? fallback.isError,
        returnDisplay: result.returnDisplay,
        llmContent: result.llmContent ?? result.content ?? fallback.llmContent,
      };
    }
  } catch {
    // ignore parse errors
  }

  return fallback;
}

function extractResultText(resultPart: ToolResultPart): string {
  const result = parseToolResult(resultPart);

  // 1. 优先使用returnDisplay
  if (result.returnDisplay) {
    if (typeof result.returnDisplay === 'string') {
      return result.returnDisplay;
    }
    // 处理特定的returnDisplay类型
    if (typeof result.returnDisplay === 'object' && 'type' in result.returnDisplay) {
      if (result.returnDisplay.type === 'todo_write') {
        return 'Updated todos';
      }
      if (result.returnDisplay.type === 'agent_result') {
        const stats = result.returnDisplay.stats;
        return `${result.returnDisplay.status} (${stats.toolCalls} tool uses · ${stats.tokens.input + stats.tokens.output} tokens)`;
      }
    }
  }

  // 2. 回退到llmContent
  const content = result.llmContent;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p: any) => {
        if (p.type === 'text') return p.text;
        if (p.type === 'image') return '[Image]';
        return '';
      })
      .join(' ');
  }
  return '...';
}

/**
 * 格式化工具参数
 */
function formatToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  transcriptMode: boolean
): string {
  if (toolName === 'todoWrite') {
    const todos = args.todos as Array<{ content: string; status: string }>;
    if (Array.isArray(todos)) {
      const inProgressTodo = todos.find((t) => t.status === 'in_progress');
      const completed = todos.filter((t) => t.status === 'completed').length;
      const pending = todos.filter((t) => t.status === 'pending').length;
      if (inProgressTodo) {
        const taskName =
          transcriptMode || inProgressTodo.content.length <= 40
            ? inProgressTodo.content
            : `${inProgressTodo.content.substring(0, 40)}...`;
        return `"${taskName}" [${completed}/${todos.length}]`;
      }
      return `${todos.length} todos: ${completed} done, ${pending} pending`;
    }
  }

  if (toolName === 'bash') {
    const cmd = args.command as string;
    if (cmd) {
      if (transcriptMode) {
        return cmd;
      }
      const firstLine = cmd.split('\n')[0];
      const truncated = firstLine.length > 60 ? `${firstLine.substring(0, 60)}...` : firstLine;
      const result = cmd.includes('\n') ? `${truncated}` : truncated;

      // 最终长度保护，确保最多200个字符
      return result.length > 200 ? `${result.substring(0, 200)}...` : result;
    }
  }

  const values = Object.values(args);
  if (values.length === 0) return '';
  return values
    .map((v) => {
      if (v === undefined || v === null || v === '') {
        return '';
      }
      const str = JSON.stringify(v);
      if (transcriptMode || str.length <= 80) {
        return str;
      }
      return `${str.substring(0, 80)}...`;
    })
    .join(', ');
}

export function LogItemRenderer({ item }: LogItemRendererProps) {
  const { transcriptMode = false } = useAppContext();

  // 用户消息
  if (item.type === 'user') {
    return (
      <Box paddingLeft={1}>
        <Text color="gray">
          {'>'} {item.content}
        </Text>
      </Box>
    );
  }

  // 工具交互
  if (item.type === 'tool' && item.toolUse) {
    const { toolUse, toolResult } = item;

    // 使用description（如果可用），否则格式化参数
    const args = transcriptMode
      ? toolUse.description || formatToolArgs(toolUse.name, toolUse.input, true)
      : toolUse.description || formatToolArgs(toolUse.name, toolUse.input, false);

    // 最终参数长度保护（处理description情况）
    // 同时确保单行显示，只取第一行
    let displayArgs = args;
    if (!transcriptMode) {
      const firstLine = args.split('\n')[0];
      displayArgs = firstLine.length > 200 ? `${firstLine.substring(0, 200)}...` : firstLine;
    }

    const resultText = toolResult ? extractResultText(toolResult).trim() : '...';

    // 将结果分行以优雅处理多行输出
    const resultLines = resultText.split('\n');
    const firstLine = resultLines[0];
    const hasMore = resultLines.length > 1;

    // 截断第一行（除非在transcript模式）
    const displayResult = transcriptMode
      ? resultText
      : firstLine.length > 200
        ? `${firstLine.substring(0, 200)}...`
        : firstLine + (hasMore ? '...' : '');

    const isError = toolResult ? parseToolResult(toolResult).isError : false;

    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Box>
          <Text color="cyan" bold>
            {toolUse.displayName || toolUse.name}
          </Text>
          <Text color="gray">({displayArgs})</Text>
        </Box>
        {toolResult && (
          <Box paddingLeft={2}>
            <Text color={isError ? 'red' : 'gray'}>{displayResult}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // 文本消息（Assistant思考/回复）
  if (item.type === 'text') {
    const trimmedContent = item.content?.trim();
    if (!trimmedContent) return null;

    return (
      <Box paddingLeft={1}>
        <Text color="gray"> {trimmedContent}</Text>
      </Box>
    );
  }

  return null;
}
