import { Box, Static, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React, { useMemo } from 'react';
import type { EnhancedMessage } from '../../types/index';
import { selectWorkbenchTranscript } from '../workbench/WorkbenchTranscriptService';
import { EnhancedMessageList } from './EnhancedMessageList';

interface WorkbenchTranscriptProps {
  messages: EnhancedMessage[];
  maxMessages?: number;
}

/**
 * Static transcript for completed conversation messages.
 *
 * Inspired by mature coding-agent CLIs: completed messages are appended to
 * Ink's Static region, while the timeline/input area remains the only dynamic
 * surface. This avoids repainting the full transcript on every keystroke.
 */
export const WorkbenchTranscript: React.FC<WorkbenchTranscriptProps> = ({
  messages,
  maxMessages = 20,
}) => {
  const transcript = useMemo(
    () => selectWorkbenchTranscript(messages, maxMessages),
    [messages, maxMessages]
  );
  const hiddenCount = Math.max(0, messages.length - transcript.length);

  if (messages.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {hiddenCount > 0 && (
        <Text color="gray" dimColor>
          Showing latest {transcript.length} messages · {hiddenCount} older hidden
        </Text>
      )}
      <Static items={transcript}>
        {(item) => (
          <EnhancedMessageList
            key={item.key}
            messages={[item.message]}
            isStreaming={false}
            streamingText=""
            showTimestamps={false}
            showMessageIds={false}
            maxVisibleMessages={1}
          />
        )}
      </Static>
    </Box>
  );
};
