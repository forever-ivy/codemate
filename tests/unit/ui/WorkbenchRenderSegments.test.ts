import { describe, expect, it } from 'vitest';
import type { EnhancedMessage } from '../../../src/types/index';
import { splitWorkbenchMessages } from '../../../src/ui/workbench/WorkbenchRenderSegments';

describe('WorkbenchRenderSegments', () => {
  it('keeps the newest conversation turn dynamic while a run is active', () => {
    const messages = [user('old request'), assistant('old answer'), user('current request')];

    const result = splitWorkbenchMessages(messages, true, 2);

    expect(result.completedMessages.map(messageText)).toEqual(['old request', 'old answer']);
    expect(result.pendingMessages.map(messageText)).toEqual(['current request']);
  });

  it('moves every message to the static segment when the run is idle', () => {
    const messages = [user('request'), assistant('complete')];

    const result = splitWorkbenchMessages(messages, false);

    expect(result.completedMessages).toEqual(messages);
    expect(result.pendingMessages).toEqual([]);
  });

  it('keeps assistant-only live output dynamic until the run finishes', () => {
    const messages = [assistant('working')];

    const result = splitWorkbenchMessages(messages, true, 0);

    expect(result.completedMessages).toEqual([]);
    expect(result.pendingMessages).toEqual(messages);
  });

  it('never moves previously completed messages back out of Static', () => {
    const messages = [user('old request'), assistant('old answer')];

    const result = splitWorkbenchMessages(messages, true, messages.length);

    expect(result.completedMessages).toEqual(messages);
    expect(result.pendingMessages).toEqual([]);
  });
});

function user(content: string): EnhancedMessage {
  return message('user', content);
}

function assistant(content: string): EnhancedMessage {
  return message('assistant', content);
}

function message(role: 'user' | 'assistant', content: string): EnhancedMessage {
  return {
    uuid: `${role}-${content}`,
    parentUuid: null,
    role,
    content,
    timestamp: 1,
  };
}

function messageText(message: EnhancedMessage): string {
  return typeof message.content === 'string' ? message.content : '';
}
