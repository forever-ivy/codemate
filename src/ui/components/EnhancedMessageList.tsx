/**
 * 增强消息列表组件
 *
 * 支持虚拟滚动、丰富交互和流式显示
 */
import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React, { useMemo } from 'react';
import type { ContentBlock, EnhancedMessage } from '../../types/index.js';
import { useTheme } from '../theme/ThemeSystem.js';
import { StatusIndicator } from './StatusIndicator.js';
import { StreamingText } from './StreamingText.js';
import { TerminalMarkdown } from './TerminalMarkdown.js';

interface EnhancedMessageListProps {
  messages: EnhancedMessage[];
  isStreaming?: boolean;
  streamingText?: string;
  maxVisibleMessages?: number;
  showTimestamps?: boolean;
  showMessageIds?: boolean;
}

export const EnhancedMessageList: React.FC<EnhancedMessageListProps> = ({
  messages,
  isStreaming = false,
  streamingText = '',
  maxVisibleMessages = 50,
  showTimestamps = false,
  showMessageIds = false,
}) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  // 虚拟滚动实现
  const visibleMessages = useMemo(() => {
    if (messages.length <= maxVisibleMessages) {
      return messages;
    }
    return messages.slice(-maxVisibleMessages);
  }, [messages, maxVisibleMessages]);

  const renderMessage = (message: EnhancedMessage, index: number) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    // 注意：当前类型系统中可能没有tool角色，所以我们简化处理
    const isTool = false;

    return (
      <Box key={index} flexDirection="column" marginBottom={1}>
        {/* 消息头部 */}
        <Box flexDirection="row" alignItems="center" marginBottom={0}>
          {/* 角色指示器 */}
          <Box marginRight={1}>
            {isUser && (
              <Text color={colors.success} bold>
                ▶ You
              </Text>
            )}
            {isAssistant && (
              <Text color={colors.primary} bold>
                🤖 Assistant
              </Text>
            )}
            {isTool && (
              <Text color={colors.warning} bold>
                🔧 Tool
              </Text>
            )}
          </Box>

          {/* 时间戳 */}
          {showTimestamps && message.timestamp && (
            <Text color={colors.text.secondary} dimColor>
              {new Date(message.timestamp).toLocaleTimeString()}
            </Text>
          )}

          {/* 消息 ID */}
          {showMessageIds && message.uuid && (
            <Text color={colors.text.disabled} dimColor>
              {message.uuid.slice(0, 8)}
            </Text>
          )}
        </Box>

        {/* 消息内容 */}
        <Box
          flexDirection="column"
          paddingLeft={2}
          borderLeft={true}
          borderColor={isUser ? colors.success : isAssistant ? colors.primary : colors.warning}
        >
          {renderMessageContent(message)}
        </Box>
      </Box>
    );
  };

  const renderMessageContent = (message: EnhancedMessage) => {
    if (typeof message.content === 'string') {
      if (message.role === 'assistant') {
        return <TerminalMarkdown content={message.content} />;
      }

      return <Text color={theme.getCurrentTheme().text.primary}>{message.content}</Text>;
    }

    // 处理工具调用
    if (Array.isArray(message.content)) {
      return (
        <Box flexDirection="column">
          {message.content.map((item) => (
            <Box key={contentBlockKey(item)} marginBottom={0}>
              {item.type === 'tool_use' && (
                <Box flexDirection="column">
                  <Text color={colors.warning} bold>
                    🔧 {item.name}
                  </Text>
                  <Text color={colors.text.secondary}>{JSON.stringify(item.input, null, 2)}</Text>
                </Box>
              )}
              {item.type === 'tool_result' && (
                <Box flexDirection="column">
                  <Text color={colors.success} bold>
                    ✅ Result
                  </Text>
                  <Text color={colors.text.primary}>
                    {typeof item.content === 'string' ? item.content : JSON.stringify(item.content)}
                  </Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      );
    }

    return <Text color={colors.text.secondary}>[Complex content]</Text>;
  };

  return (
    <Box flexDirection="column">
      {/* 历史消息 */}
      {visibleMessages.map((message, index) => renderMessage(message, index))}

      {/* 流式输出 */}
      {isStreaming && streamingText && (
        <Box flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" alignItems="center" marginBottom={0}>
            <Text color={colors.primary} bold>
              🤖 Assistant
            </Text>
            <StatusIndicator status="streaming" />
          </Box>

          <Box
            flexDirection="column"
            paddingLeft={2}
            borderLeft={true}
            borderColor={colors.primary}
          >
            <StreamingText
              text={streamingText}
              speed={50}
              showCursor={true}
              highlightSyntax={true}
            />
          </Box>
        </Box>
      )}

      {/* 消息统计 */}
      {messages.length > maxVisibleMessages && (
        <Box justifyContent="center" marginTop={1}>
          <Text color={colors.text.secondary} dimColor>
            Showing {maxVisibleMessages} of {messages.length} messages
          </Text>
        </Box>
      )}
    </Box>
  );
};

function contentBlockKey(item: ContentBlock): string {
  switch (item.type) {
    case 'tool_use':
      return `tool-use-${item.id}`;
    case 'tool_result':
      return `tool-result-${item.tool_use_id}`;
    case 'text':
      return `text-${item.text}`;
  }
}
