/** Compact idle state that keeps the complete dynamic frame below terminal height. */
import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme/ThemeSystem.js';

interface WelcomeScreenProps {
  version?: string;
  showTips?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  version = 'v1.0.5',
  showTips = true,
}) => {
  const colors = useTheme().getCurrentTheme();

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row">
        <Text color={colors.primary} bold>
          CodeMate
        </Text>
        <Text color={colors.text.secondary}> · {version}</Text>
      </Box>

      {showTips && (
        <Text color={colors.text.secondary}>
          Start with a task · <Text color={colors.primary}>/help</Text> commands ·{' '}
          <Text color={colors.primary}>/model</Text> switch model
        </Text>
      )}
    </Box>
  );
};
