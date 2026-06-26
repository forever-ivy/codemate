import { Box, Text } from 'ink';
import React from 'react';
import { useTheme } from '../theme/ThemeSystem.js';

/**
 * 状态栏组件
 *
 * 底部状态栏，显示模型、项目、进度等信息
 */
interface StatusBarProps {
  model?: string;
  project?: string;
  progress?: string;
  sessionId?: string;
  status?: 'idle' | 'thinking' | 'streaming' | 'error';
}

export function StatusBar({
  model = 'deepseek-chat',
  project = 'workspace',
  progress = '100%',
  sessionId,
  status = 'idle',
}: StatusBarProps) {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  const getStatusColor = () => {
    switch (status) {
      case 'thinking':
        return colors.warning;
      case 'streaming':
        return colors.info;
      case 'error':
        return colors.error;
      default:
        return colors.success;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'thinking':
        return 'Thinking...';
      case 'streaming':
        return 'Streaming...';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  };

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      borderTop={true}
      borderColor={colors.border}
    >
      {/* 左侧：模型和项目信息 */}
      <Box flexDirection="row">
        <Text color={colors.text.secondary}>[</Text>
        <Text color={colors.primary} bold>
          {model}
        </Text>
        <Text color={colors.text.secondary}>] |</Text>
        <Text color={colors.accent}>{project}</Text>
        <Text color={colors.text.secondary}>{' | '}</Text>
        <Text color={getStatusColor()}>{getStatusText()}</Text>
      </Box>

      {/* 右侧：进度和会话信息 */}
      <Box flexDirection="row">
        <Text color={colors.success}>{progress}</Text>
        <Text color={colors.text.secondary}>{' | '}</Text>
        {sessionId && (
          <>
            <Text color={colors.info}>ID</Text>
            <Text color={colors.text.secondary}> </Text>
            <Text color={colors.text.primary}>{sessionId.slice(0, 8)}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
