import { Text } from 'ink';
import { render } from 'ink-testing-library';
import React, { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type AgentMessageQueueApi,
  useAgentMessageQueue,
} from '../../../src/ui/hooks/useAgentMessageQueue';

describe('useAgentMessageQueue', () => {
  let api: AgentMessageQueueApi;
  let nextId = 0;

  beforeEach(() => {
    nextId = 0;
    render(<Harness onChange={(value) => (api = value)} />);
  });

  it('takes queued messages in FIFO order', () => {
    act(() => {
      api.enqueue('first');
      api.enqueue('second');
    });

    let first: ReturnType<AgentMessageQueueApi['takeNext']>;
    let second: ReturnType<AgentMessageQueueApi['takeNext']>;
    act(() => {
      first = api.takeNext();
      second = api.takeNext();
    });

    expect(first?.content).toBe('first');
    expect(second?.content).toBe('second');
    expect(api.queuedMessages).toEqual([]);
  });

  it('removes one queued message without changing the others', () => {
    act(() => {
      api.enqueue('first');
      api.enqueue('second');
    });
    const firstId = api.queuedMessages[0]?.id;

    act(() => api.remove(firstId ?? ''));

    expect(api.queuedMessages.map((item) => item.content)).toEqual(['second']);
  });

  function Harness({ onChange }: { onChange: (value: AgentMessageQueueApi) => void }) {
    const queue = useAgentMessageQueue({
      createId: () => `queue-${++nextId}`,
      now: () => 1_000,
    });
    onChange(queue);
    return <Text>{queue.queuedMessages.length}</Text>;
  }
});
