import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React from 'react';
import type { AgentRunSummary } from '../workbench/AgentRunSummaryService';
import { useTheme } from '../theme/ThemeSystem';

interface AgentRunSummaryListProps {
  summaries: AgentRunSummary[];
}

/**
 * Shows only the newest completed run in the dynamic terminal tail.
 *
 * The full assistant report is already persisted in the Static transcript.
 * Keeping another accumulating Static list here would duplicate history and
 * make Ink reserve stale rows, which presents as a large blank terminal area.
 */
export const AgentRunSummaryList: React.FC<AgentRunSummaryListProps> = ({ summaries }) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();
  const summary = summaries.at(-1);
  if (!summary) {
    return null;
  }

  const status = formatStatus(summary.result);
  const changedFiles =
    summary.changedFiles.length > 0 ? summary.changedFiles.join(', ') : 'No file changes';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={status.color} bold>
        {status.label}
      </Text>
      {summary.summary && <Text wrap="wrap">{summary.summary}</Text>}
      {summary.showEvidence && (
        <>
          <Text>
            <Text color={colors.accent}>Changed </Text>
            <Text
              color={summary.changedFiles.length > 0 ? colors.text.primary : colors.text.secondary}
            >
              {changedFiles}
            </Text>
          </Text>
          <Text>
            <Text color={colors.success}>Verified </Text>
            <Text
              color={
                summary.verification === 'Not run' ? colors.text.secondary : colors.text.primary
              }
            >
              {summary.verification}
            </Text>
          </Text>
        </>
      )}
      {summary.error && <Text color="red">Error: {summary.error}</Text>}
    </Box>
  );
};

function formatStatus(result: AgentRunSummary['result']): { label: string; color: string } {
  switch (result) {
    case 'completed':
      return { label: '✓ Completed', color: 'green' };
    case 'incomplete':
      return { label: '○ Incomplete', color: 'yellow' };
    case 'failed':
      return { label: '✕ Failed', color: 'red' };
  }
}
