import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React, { useMemo } from 'react';
import { useTheme } from '../theme/ThemeSystem';
import { buildGroupedAgentTimeline } from '../workbench/AgentTimelineService';
import type { TaskItem } from './TaskTracker';
import { ToolActivityCard } from './ToolActivityCard';

interface AgentProgressTimelineProps {
  tasks: TaskItem[];
  currentTask?: string;
  maxVisibleItems?: number;
  nowMs?: number;
}

/**
 * Shows recent agent work as a bounded timeline instead of a flat task list.
 * Running and failed state remain visible as task events update the same IDs.
 */
export const AgentProgressTimeline: React.FC<AgentProgressTimelineProps> = ({
  tasks,
  currentTask,
  maxVisibleItems = 3,
  nowMs,
}) => {
  const colors = useTheme().getCurrentTheme();
  const timeline = useMemo(
    () => buildGroupedAgentTimeline(tasks, currentTask, nowMs),
    [tasks, currentTask, nowMs]
  );

  if (timeline.length === 0) {
    return null;
  }

  const visibleItems = timeline.slice(-Math.max(1, maxVisibleItems));

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" marginBottom={1}>
        <Text color={colors.primary} bold>
          Activity Timeline
        </Text>
        <Text color={colors.text.secondary}>{` · ${timeline.length} activities`}</Text>
      </Box>

      {visibleItems.map((item) => (
        <ToolActivityCard key={item.id} item={item} />
      ))}
    </Box>
  );
};
