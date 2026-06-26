import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React from 'react';
import { buildProcessingIndicatorViewModel } from '../workbench/ProcessingIndicatorViewModel';

interface ProcessingIndicatorProps {
  active: boolean;
  startedAt?: number;
  currentTask?: string;
  now?: number;
}

/** A single-line, low-frequency activity indicator for the current agent run. */
export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  active,
  startedAt,
  currentTask,
  now,
}) => {
  const viewModel = buildProcessingIndicatorViewModel({
    active,
    startedAt,
    now: now ?? startedAt ?? Date.now(),
    currentTask,
  });
  if (!viewModel) {
    return null;
  }

  const meta = ['Ctrl+C to cancel', `${viewModel.elapsedSeconds}s`, viewModel.detail].filter(
    Boolean
  );

  return (
    <Box flexDirection="row">
      <Text color="cyan">● Processing...</Text>
      <Text color="gray"> {`(${meta.join(' · ')})`}</Text>
    </Box>
  );
};
