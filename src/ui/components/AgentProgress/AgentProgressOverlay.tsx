/**
 * Agent进度覆盖层 - 显示AI任务执行状态
 */
import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { AgentProgressState, ToolUsePart, ToolResultPart } from './types';
import { useAppContext } from '../../context/AppContext';
import { LogItemRenderer } from './LogItemRenderer';
import { calculateStats, formatDuration, formatTokens, groupMessages } from './utils';

const VISIBLE_MESSAGE_LIMIT = 3;

const COLORS = {
  RUNNING: 'gray',
  COMPLETED: 'green',
  FAILED: 'red',
  AGENT_TYPE: 'cyan',
  HINT: 'gray',
} as const;

interface AgentToolUseProps {
  toolUse: ToolUsePart;
  status: 'starting' | 'running' | 'completed' | 'failed';
  model?: string;
}

function AgentToolUse({ toolUse, status, model }: AgentToolUseProps) {
  const agentType = toolUse.input?.subagent_type || toolUse.name;
  const description = toolUse.input?.description;

  const showModel = useMemo(() => {
    if (!model) return false;
    // 简化的模型显示逻辑
    return true;
  }, [model]);

  const descText = useMemo(() => {
    if (!description && !showModel) return null;
    const parts: string[] = [];
    if (description) parts.push(description);
    if (showModel && model) parts.push(`with ${model}`);
    return parts.join(' ');
  }, [description, showModel, model]);

  const color = useMemo(() => {
    if (status === 'starting') return COLORS.RUNNING;
    if (status === 'completed') return COLORS.COMPLETED;
    if (status === 'failed') return COLORS.FAILED;
    return 'blue';
  }, [status]);

  const descColor = useMemo(() => {
    if (status === 'completed') return COLORS.HINT;
    if (status === 'failed') return COLORS.HINT;
    return 'gray';
  }, [status]);

  return (
    <Box marginTop={1}>
      <Text bold color={color}>
        {agentType}
      </Text>
      {descText && <Text color={descColor}> ({descText})</Text>}
    </Box>
  );
}

interface AgentProgressOverlayProps {
  toolUse: ToolUsePart;
}

export function AgentStarting({ toolUse }: AgentProgressOverlayProps) {
  const text = 'Initializing...';

  return (
    <Box flexDirection="column" paddingX={1}>
      <AgentToolUse toolUse={toolUse} status="running" />
      <Box marginTop={1} paddingLeft={1}>
        <Text color="gray">↓ {text}</Text>
      </Box>
    </Box>
  );
}

interface AgentInProgressProps {
  toolUse: ToolUsePart;
  progressData: AgentProgressState;
}

export function AgentInProgress({ toolUse, progressData }: AgentInProgressProps) {
  const { transcriptMode = false } = useAppContext();
  const { messages } = progressData;

  // 计算统计信息
  const stats = useMemo(() => calculateStats(messages), [messages]);

  // 将消息分组为LogItems
  const logItems = useMemo(() => groupMessages(messages), [messages]);

  // 智能截断：默认只显示最后N个项目
  const visibleItems = transcriptMode ? logItems : logItems.slice(-VISIBLE_MESSAGE_LIMIT);
  const hiddenCount = logItems.length - visibleItems.length;

  const prompt = toolUse.input?.prompt;

  return (
    <Box flexDirection="column">
      {/* 头部 */}
      <AgentToolUse toolUse={toolUse} status="running" model={progressData.model} />

      {/* 消息列表 */}
      <Box flexDirection="column">
        {!transcriptMode && hiddenCount > 0 && (
          <Box paddingLeft={1}>
            <Text color={COLORS.HINT} dimColor>
              ... {hiddenCount} more items
            </Text>
          </Box>
        )}

        {/* 在transcript模式下显示prompt */}
        {transcriptMode && prompt && (
          <Box flexDirection="column" marginLeft={2} marginTop={1}>
            <Box flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="gray">↳ </Text>
                <Text bold color="cyan">
                  Prompt:
                </Text>
              </Box>
              <Text color="gray">{prompt}</Text>
            </Box>
          </Box>
        )}

        {visibleItems.map((item) => (
          <LogItemRenderer key={item.id} item={item} />
        ))}
      </Box>

      {/* 状态栏 */}
      <Box paddingLeft={1} marginTop={0}>
        <Text color="gray" dimColor>
          {' '}
          {!transcriptMode && '(Press ctrl+o to expand) · '}
          {stats.toolCalls} tool uses · {formatTokens(stats.tokens)} tokens
        </Text>
      </Box>
    </Box>
  );
}
interface AgentResultProps {
  toolUse: ToolUsePart;
  toolResult: ToolResultPart;
}

function parseToolResult(toolResult: ToolResultPart): {
  isError: boolean;
  returnDisplay?: any;
  llmContent?: any;
} {
  const fallback = {
    isError: toolResult.is_error ?? false,
    llmContent: toolResult.content,
  };

  try {
    const parsed = JSON.parse(toolResult.content);
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

export function AgentCompletedResult({ toolUse, toolResult }: AgentResultProps) {
  const { transcriptMode = false } = useAppContext();
  const parsed = parseToolResult(toolResult);
  const isError = parsed.isError;
  const returnDisplay = parsed.returnDisplay as any;

  const prompt = returnDisplay?.prompt || toolUse.input?.prompt || 'N/A';
  const content =
    returnDisplay?.content ||
    (typeof parsed.llmContent === 'string' ? parsed.llmContent : JSON.stringify(parsed.llmContent));
  const stats = returnDisplay?.stats;

  const StatsDisplay = useMemo(() => {
    if (isError) {
      return (
        <Box marginLeft={2}>
          <Text color={COLORS.FAILED}>Failed {content}</Text>
        </Box>
      );
    }

    if (!stats) {
      return null;
    }

    return (
      <Box marginLeft={2}>
        <Text color="gray">
          {'Done'} ({stats.toolCalls} tool uses ·{' '}
          {formatTokens(stats.tokens.input + stats.tokens.output)} tokens
          {stats.duration && ` · ${formatDuration(stats.duration)}`})
        </Text>
      </Box>
    );
  }, [stats, isError, content]);

  return (
    <Box flexDirection="column" marginTop={1}>
      <AgentToolUse
        toolUse={toolUse}
        status={isError ? 'failed' : 'completed'}
        model={returnDisplay?.model}
      />

      {StatsDisplay}

      {transcriptMode && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Box flexDirection="column" marginLeft={2}>
            <Box flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="gray">↳ </Text>
                <Text bold color="cyan">
                  Prompt:
                </Text>
              </Box>
              <Text color="gray">{prompt}</Text>
            </Box>

            <Box flexDirection="column">
              <Box>
                <Text color="gray">↳ </Text>
                <Text bold color="cyan">
                  Response:
                </Text>
              </Box>
              <Text color="gray">{content}</Text>
            </Box>
          </Box>
        </Box>
      )}

      {!transcriptMode && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            Press ctrl+o to expand
          </Text>
        </Box>
      )}
    </Box>
  );
}
