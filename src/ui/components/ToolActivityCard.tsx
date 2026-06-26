import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React from 'react';
import { useTheme } from '../theme/ThemeSystem';
import type { AgentTimelineItem } from '../workbench/AgentTimelineService';

interface ToolActivityCardProps {
  item: AgentTimelineItem;
}

/** Renders one timeline activity as a compact terminal-native card. */
export const ToolActivityCard: React.FC<ToolActivityCardProps> = ({ item }) => {
  const colors = useTheme().getCurrentTheme();
  const status = statusPresentation(item.status);

  return (
    <Box
      flexDirection="column"
      borderLeft={true}
      borderColor={status.color}
      paddingLeft={1}
      marginBottom={1}
    >
      <Box flexDirection="row">
        <Box width={4} flexShrink={0}>
          <Text color={colors.text.secondary} dimColor>
            {String(item.sequence).padStart(2, '0')}{' '}
          </Text>
        </Box>
        <Text color={kindColor(item.kind)} bold>
          [{kindLabel(item.kind)}]
        </Text>
        <Text color={status.color}> {status.arrow} </Text>
        <Text>{item.title} </Text>
        <Text color={status.color} bold>
          {status.symbol} {status.label}
        </Text>
        {item.groupedCount !== undefined && (
          <Text color={colors.text.secondary} dimColor>
            {` · ${item.groupedCount} ${item.groupedCount === 1 ? 'tool' : 'tools'}`}
          </Text>
        )}
        {item.durationMs !== undefined && (
          <Text color={colors.text.secondary} dimColor>
            {` · ${formatDuration(item.durationMs)}`}
          </Text>
        )}
      </Box>

      {item.detail && (
        <Text color={item.status === 'failed' ? colors.error : colors.text.secondary}>
          {item.detail}
        </Text>
      )}
    </Box>
  );
};

function kindLabel(kind: AgentTimelineItem['kind']): string {
  switch (kind) {
    case 'intent':
      return 'INTENT';
    case 'plan':
      return 'PLAN';
    case 'model':
      return 'MODEL';
    case 'explore':
      return 'EXPLORE';
    case 'edit':
      return 'EDIT';
    case 'verification':
      return 'VERIFY';
    case 'repair':
      return 'REPAIR';
    case 'result':
      return 'RESULT';
    default:
      return 'TOOL';
  }
}

function kindColor(kind: AgentTimelineItem['kind']): string {
  switch (kind) {
    case 'intent':
      return 'blue';
    case 'plan':
      return 'magenta';
    case 'model':
      return 'blue';
    case 'explore':
      return 'cyan';
    case 'edit':
      return 'magenta';
    case 'verification':
      return 'yellow';
    case 'repair':
      return 'red';
    case 'result':
      return 'green';
    default:
      return 'cyan';
  }
}

function statusPresentation(status: AgentTimelineItem['status']): {
  symbol: string;
  label: string;
  color: string;
  arrow: string;
} {
  switch (status) {
    case 'running':
      return { symbol: '●', label: 'RUNNING', color: 'blue', arrow: '▶' };
    case 'completed':
      return { symbol: '✓', label: 'DONE', color: 'green', arrow: '✓' };
    case 'failed':
      return { symbol: '×', label: 'FAILED', color: 'red', arrow: '!' };
    default:
      return { symbol: '○', label: 'PENDING', color: 'gray', arrow: '·' };
  }
}

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  return `${(ms / 1_000).toFixed(1)}s`;
}
