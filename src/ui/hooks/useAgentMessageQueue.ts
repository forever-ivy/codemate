import { nanoid } from 'nanoid';
import { useCallback, useRef, useState } from 'react';

export interface QueuedAgentMessage {
  id: string;
  content: string;
  queuedAt: number;
}

export interface AgentMessageQueueApi {
  queuedMessages: QueuedAgentMessage[];
  enqueue(content: string): QueuedAgentMessage;
  remove(id: string): void;
  takeNext(): QueuedAgentMessage | undefined;
  clear(): void;
}

interface AgentMessageQueueOptions {
  createId?: () => string;
  now?: () => number;
}

/**
 * Stores requests submitted while AgentLoop is busy.
 *
 * A ref mirrors React state so async run completion handlers can dequeue the
 * newest value without waiting for another render. Execution remains FIFO and
 * strictly serial; this hook never starts AgentLoop itself.
 */
export function useAgentMessageQueue(options: AgentMessageQueueOptions = {}): AgentMessageQueueApi {
  const [queuedMessages, setQueuedMessages] = useState<QueuedAgentMessage[]>([]);
  const queueRef = useRef<QueuedAgentMessage[]>([]);
  const createIdRef = useRef(options.createId ?? nanoid);
  const nowRef = useRef(options.now ?? Date.now);

  const commit = useCallback((next: QueuedAgentMessage[]) => {
    queueRef.current = next;
    setQueuedMessages(next);
  }, []);

  const enqueue = useCallback(
    (content: string) => {
      const item = {
        id: createIdRef.current(),
        content,
        queuedAt: nowRef.current(),
      };
      commit([...queueRef.current, item]);
      return item;
    },
    [commit]
  );

  const remove = useCallback(
    (id: string) => commit(queueRef.current.filter((item) => item.id !== id)),
    [commit]
  );

  const takeNext = useCallback(() => {
    const [next, ...remaining] = queueRef.current;
    if (next) {
      commit(remaining);
    }
    return next;
  }, [commit]);

  const clear = useCallback(() => commit([]), [commit]);

  return { queuedMessages, enqueue, remove, takeNext, clear };
}
