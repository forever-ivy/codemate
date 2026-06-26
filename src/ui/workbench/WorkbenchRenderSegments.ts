import type { EnhancedMessage } from '../../types/index';

export interface WorkbenchRenderSegments {
  completedMessages: EnhancedMessage[];
  pendingMessages: EnhancedMessage[];
}

/**
 * Separates immutable conversation history from the current dynamic turn.
 *
 * Completed messages can be handed to Ink Static and never repainted. While a
 * run is active, only the newest user turn and messages after it stay dynamic.
 */
export function splitWorkbenchMessages(
  messages: EnhancedMessage[],
  runActive: boolean,
  dynamicStartIndex = messages.length
): WorkbenchRenderSegments {
  if (!runActive || messages.length === 0) {
    return { completedMessages: messages, pendingMessages: [] };
  }

  const boundary = Math.max(0, Math.min(dynamicStartIndex, messages.length));

  return {
    completedMessages: messages.slice(0, boundary),
    pendingMessages: messages.slice(boundary),
  };
}
