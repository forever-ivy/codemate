import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React from 'react';
import { useTheme } from '../theme/ThemeSystem';
import { buildLiveModelOutputViewModel } from '../workbench/LiveModelOutputViewModel';

export interface LiveModelOutputState {
  runId: string;
  reasoning: string;
  text: string;
  toolName?: string;
  stage?: 'reasoning' | 'text' | 'tool' | 'step' | 'failed' | 'cancelled';
}

interface LiveModelOutputProps {
  output?: LiveModelOutputState;
}

/** Shows provider-streamed progress without letting token updates grow the terminal forever. */
export const LiveModelOutput: React.FC<LiveModelOutputProps> = ({ output }) => {
  const colors = useTheme().getCurrentTheme();
  const viewModel = buildLiveModelOutputViewModel(output);
  if (!viewModel) {
    return null;
  }

  return (
    <Box flexDirection="row" width="100%">
      <Text color={colors.primary} bold>
        {viewModel.title}
      </Text>
      <Text color={colors.text.secondary}>{` · ${viewModel.meta}`}</Text>
      <Text color={colors.text.secondary} wrap="truncate-end">
        {` · ${viewModel.preview}`}
      </Text>
    </Box>
  );
};
