import React from 'react';
import { Box, Text } from 'ink';
import type { Message } from '../../types/index';

/**
 * MessageList Props
 */
interface MessageListProps {
  messages: Message[];
}

/**
 * MessageList 组件
 *
 * 显示对话历史
 */
export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {messages.map((msg, index) => (
        <Box key={index} marginBottom={1}>
          {msg.role === 'user' ? (
            <Text color="green" bold>
              You: <Text color="white">{msg.content}</Text>
            </Text>
          ) : (
            <Text color="blue" bold>
              AI: <Text color="white">{msg.content}</Text>
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
