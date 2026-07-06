import { describe, expect, it } from 'vitest';
import type { EnhancedMessage } from '../../../src/types';
import { selectWorkbenchTranscript } from '../../../src/ui/workbench/WorkbenchTranscriptService';

describe('WorkbenchTranscriptService', () => {
  it('should keep a bounded static transcript with stable message keys', () => {
    const messages: EnhancedMessage[] = Array.from({ length: 5 }, (_, index) => ({
      uuid: `message-${index + 1}`,
      parentUuid: index === 0 ? null : `message-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message ${index + 1}`,
      timestamp: index + 1,
    }));

    const transcript = selectWorkbenchTranscript(messages, 3);

    expect(transcript.map((item) => item.key)).toEqual(['message-3', 'message-4', 'message-5']);
    expect(transcript.map((item) => item.originalIndex)).toEqual([2, 3, 4]);
    expect(transcript.map((item) => item.message.content)).toEqual([
      'message 3',
      'message 4',
      'message 5',
    ]);
  });

  it('should return an empty transcript when the max message count is zero', () => {
    const transcript = selectWorkbenchTranscript(
      [
        {
          uuid: 'message-1',
          parentUuid: null,
          role: 'user',
          content: 'hello',
          timestamp: 1,
        },
      ],
      0
    );

    expect(transcript).toEqual([]);
  });
});
