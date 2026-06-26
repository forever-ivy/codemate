import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { EnhancedMessage } from '../../types/index';

interface RewindSelectorProps {
  messages: EnhancedMessage[];
  onSelect: (messageIndex: number) => void;
  onClose: () => void;
}

export function RewindSelector({ messages, onSelect, onClose }: RewindSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 过滤出有效的回退点（排除系统消息）
  const rewindableMessages = messages.filter(
    (msg) => msg.role === 'user' || msg.role === 'assistant'
  );

  useInput((_, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev === 0 ? rewindableMessages.length - 1 : prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev === rewindableMessages.length - 1 ? 0 : prev + 1));
    } else if (key.return) {
      if (rewindableMessages[selectedIndex]) {
        // 找到选中消息在原始消息列表中的索引
        const originalIndex = messages.findIndex(
          (msg) => msg === rewindableMessages[selectedIndex]
        );
        onSelect(originalIndex);
      }
    } else if (key.escape) {
      onClose();
    }
  });

  if (rewindableMessages.length === 0) {
    return (
      <Box flexDirection="column" width="100%" height="100%" paddingX={2} paddingY={1}>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="yellow"
          paddingX={2}
          paddingY={1}
          width="100%"
        >
          <Box marginBottom={1}>
            <Text bold color="yellow">
              ⏪ Rewind Conversation
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color="gray">No messages to rewind to.</Text>
          </Box>

          <Box>
            <Text dimColor>Press ESC to cancel</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height="100%" paddingX={2} paddingY={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="magenta"
        paddingX={2}
        paddingY={1}
        width="100%"
      >
        {/* 标题 */}
        <Box marginBottom={1}>
          <Text bold color="magenta">
            ⏪ Rewind Conversation
          </Text>
        </Box>

        {/* 说明 */}
        <Box marginBottom={1}>
          <Text color="gray">Select a message to rewind to:</Text>
        </Box>

        {/* 分隔线 */}
        <Box marginBottom={1}>
          <Text color="gray">{'─'.repeat(60)}</Text>
        </Box>

        {/* 消息列表 - 按时间倒序显示 */}
        <Box flexDirection="column" marginBottom={1}>
          {rewindableMessages
            .slice()
            .reverse()
            .map((message, reverseIndex) => {
              const actualIndex = rewindableMessages.length - 1 - reverseIndex;
              const isSelected = actualIndex === selectedIndex;

              return (
                <MessageItem
                  key={`${message.timestamp || Date.now()}-${reverseIndex}`}
                  message={message}
                  isSelected={isSelected}
                  index={actualIndex}
                />
              );
            })}
        </Box>

        {/* 分隔线 */}
        <Box marginTop={1} marginBottom={1}>
          <Text color="gray">{'─'.repeat(60)}</Text>
        </Box>

        {/* 帮助文本 */}
        <Box>
          <Text dimColor>↑↓: navigate, Enter: rewind to selected, ESC: cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

interface MessageItemProps {
  message: EnhancedMessage;
  isSelected: boolean;
  index: number;
}

function MessageItem({ message, isSelected, index }: MessageItemProps) {
  const roleColor = message.role === 'user' ? 'blue' : 'green';
  const roleIcon = message.role === 'user' ? '👤' : '🤖';
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString()
    : 'Unknown time';

  // 截取消息内容预览
  const content =
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  const preview = getMessagePreview(content);

  return (
    <Box flexDirection="column" paddingY={0}>
      <Box flexDirection="row">
        {/* 选择指示器 */}
        <Box width={3}>
          <Text color={isSelected ? 'magenta' : 'gray'}>{isSelected ? '❯ ' : '  '}</Text>
        </Box>

        {/* 消息信息 */}
        <Box flexDirection="column" flexGrow={1}>
          {/* 第一行：角色和时间 */}
          <Box flexDirection="row">
            <Text color={isSelected ? roleColor : 'gray'}>
              {roleIcon} {message.role}
            </Text>
            <Box marginLeft={2}>
              <Text color={isSelected ? 'white' : 'dim'}>at {timestamp}</Text>
            </Box>
          </Box>

          {/* 第二行：内容预览 */}
          <Box paddingLeft={2}>
            <Text color={isSelected ? 'white' : 'dim'} dimColor={!isSelected}>
              {preview}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * 智能的消息内容预览
 */
function getMessagePreview(content: string): string {
  // 移除多余的空白字符
  const cleaned = content.replace(/\s+/g, ' ').trim();

  // 智能截断：优先在句号、问号、感叹号处截断
  if (cleaned.length <= 80) {
    return cleaned;
  }

  const truncated = cleaned.substring(0, 77);
  const lastPunctuation = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('?'),
    truncated.lastIndexOf('!')
  );

  if (lastPunctuation > 40) {
    return truncated.substring(0, lastPunctuation + 1);
  }

  return truncated + '...';
}
