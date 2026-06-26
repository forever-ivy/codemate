/**
 * 状态指示器组件
 *
 * 提供丰富的状态反馈
 */
import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import Spinner from 'ink-spinner';
import { useTheme } from '../theme/ThemeSystem.js';

interface StatusIndicatorProps {
  status: 'idle' | 'thinking' | 'streaming' | 'tool-calling' | 'error' | 'success';
  message?: string;
  showSpinner?: boolean;
  showIcon?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  showSpinner = true,
  showIcon = true,
}) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();
  const [dots, setDots] = useState('');

  // 动态点点点效果
  useEffect(() => {
    if (status === 'thinking' || status === 'streaming') {
      const interval = setInterval(() => {
        setDots((prev) => {
          if (prev.length >= 3) return '';
          return prev + '.';
        });
      }, 500);

      return () => clearInterval(interval);
    } else {
      setDots('');
      return undefined;
    }
  }, [status]);

  const getStatusConfig = () => {
    switch (status) {
      case 'thinking':
        return {
          color: colors.info,
          icon: '🤔',
          text: message || `AI is thinking${dots}`,
          spinner: 'dots',
        };

      case 'streaming':
        return {
          color: colors.primary,
          icon: '💭',
          text: message || `Streaming response${dots}`,
          spinner: 'line',
        };

      case 'tool-calling':
        return {
          color: colors.warning,
          icon: '🔧',
          text: message || 'Calling tools...',
          spinner: 'bouncingBar',
        };

      case 'error':
        return {
          color: colors.error,
          icon: '❌',
          text: message || 'Error occurred',
          spinner: null,
        };

      case 'success':
        return {
          color: colors.success,
          icon: '✅',
          text: message || 'Completed',
          spinner: null,
        };

      default:
        return {
          color: colors.text.secondary,
          icon: '⚪',
          text: message || 'Ready',
          spinner: null,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Text color={config.color}>
      {showSpinner && config.spinner && (
        <>
          <Spinner type={config.spinner as any} />{' '}
        </>
      )}
      {showIcon && config.icon && `${config.icon} `}
      {config.text}
    </Text>
  );
};
