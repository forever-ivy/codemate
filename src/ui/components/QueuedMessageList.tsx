import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React from 'react';
import type { QueuedAgentMessage } from '../hooks/useAgentMessageQueue';

interface QueuedMessageListProps {
  messages: QueuedAgentMessage[];
  onRemove: (id: string) => void;
}

const MAX_VISIBLE_MESSAGES = 3;
const MAX_CONTENT_LENGTH = 100;

/** Compact read-only view of requests waiting for the current run to finish. */
export const QueuedMessageList: React.FC<QueuedMessageListProps> = ({ messages }) => {
  if (messages.length === 0) {
    return null;
  }

  const visible = messages.slice(0, MAX_VISIBLE_MESSAGES);
  const hiddenCount = messages.length - visible.length;

  return (
    <Box flexDirection="column">
      <Text color="cyan">Queued · {messages.length} · Ctrl+X removes newest</Text>
      {visible.map((message, index) => (
        <Text key={message.id} color="gray" wrap="truncate-end">
          {index + 1}. {compact(message.content)}
        </Text>
      ))}
      {hiddenCount > 0 && <Text color="gray">{hiddenCount} more queued</Text>}
    </Box>
  );
};

function compact(content: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  return singleLine.length > MAX_CONTENT_LENGTH
    ? `${singleLine.slice(0, MAX_CONTENT_LENGTH - 1).trimEnd()}…`
    : singleLine;
}
