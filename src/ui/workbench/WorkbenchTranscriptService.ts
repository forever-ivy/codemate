import type { EnhancedMessage } from '../../types/index';

export interface WorkbenchTranscriptMessage {
  message: EnhancedMessage;
  originalIndex: number;
  key: string;
}

/**
 * Selects the bounded message transcript shown in the terminal.
 *
 * Terminal UIs should avoid repainting an unbounded conversation on every
 * input update. The workbench shows the latest completed messages and leaves
 * live agent activity to the dynamic timeline area.
 */
export function selectWorkbenchTranscript(
  messages: EnhancedMessage[],
  maxMessages: number
): WorkbenchTranscriptMessage[] {
  const safeMaxMessages = Math.max(0, maxMessages);
  const startIndex = Math.max(0, messages.length - safeMaxMessages);

  return messages.slice(startIndex).map((message, offset) => {
    const originalIndex = startIndex + offset;
    return {
      message,
      originalIndex,
      key: message.uuid || `${message.role}-${originalIndex}`,
    };
  });
}
