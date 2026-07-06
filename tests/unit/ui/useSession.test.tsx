import { Text } from 'ink';
import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Application } from '../../../src/application/Application';
import { EventBus } from '../../../src/services/EventBus';
import { EventType, type Session, type SessionMetadata } from '../../../src/types/index';
import { AppContextProvider } from '../../../src/ui/context/AppContext';
import { useSession } from '../../../src/ui/hooks/useSession';

describe('useSession', () => {
  it('should start a new session instead of loading previous conversation history', async () => {
    const eventBus = new EventBus();
    const previousSession: Session = {
      id: 'session-old',
      messages: [{ role: 'assistant', content: 'Old conversation' }],
    };
    const newSession: Session = {
      id: 'session-new',
      messages: [],
      config: { summary: 'New conversation' },
    };
    const sessionService = {
      list: vi.fn(() => [
        {
          sessionId: previousSession.id,
          summary: 'Previous conversation',
          messageCount: previousSession.messages.length,
          modified: new Date('2026-04-20T00:00:00.000Z'),
          created: new Date('2026-04-20T00:00:00.000Z'),
        },
      ]),
      load: vi.fn(async () => previousSession),
      create: vi.fn(async () => newSession),
      setCurrent: vi.fn(),
      getCurrent: vi.fn(() => newSession),
    };
    const app = createApp(sessionService, eventBus);

    function TestComponent() {
      const { currentSession } = useSession();
      return <Text>{`session:${currentSession?.id ?? 'none'}`}</Text>;
    }

    const { lastFrame } = render(
      <AppContextProvider app={app}>
        <TestComponent />
      </AppContextProvider>
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('session:session-new');
    });
    expect(sessionService.create).toHaveBeenCalledWith('New conversation');
    expect(sessionService.load).not.toHaveBeenCalled();
  });

  it('should refresh session state when a message event is emitted', async () => {
    const eventBus = new EventBus();
    const session: Session = {
      id: 'session-1',
      messages: [],
      config: {
        summary: 'Test session',
      },
    };

    const sessions: SessionMetadata[] = [
      {
        sessionId: 'session-1',
        summary: 'Test session',
        messageCount: 0,
        modified: new Date('2026-04-20T00:00:00.000Z'),
        created: new Date('2026-04-20T00:00:00.000Z'),
      },
    ];

    const sessionService = {
      list: vi.fn(() => sessions),
      load: vi.fn(async () => session),
      create: vi.fn(async () => session),
      setCurrent: vi.fn(),
      getCurrent: vi.fn(() => session),
    };

    const app = createApp(sessionService, eventBus);

    function TestComponent() {
      const { currentSession } = useSession();
      return <Text>{`messages:${currentSession?.messages.length ?? 0}`}</Text>;
    }

    const { lastFrame } = render(
      <AppContextProvider app={app}>
        <TestComponent />
      </AppContextProvider>
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastFrame()).toContain('messages:0');

    session.messages.push({
      role: 'assistant',
      content: 'Available slash commands',
    });
    sessions[0] = {
      ...sessions[0],
      messageCount: 1,
      modified: new Date('2026-04-20T00:01:00.000Z'),
    };

    eventBus.emit(EventType.MESSAGE_SENT, {
      sessionId: session.id,
      message: {
        role: 'assistant',
        content: 'Available slash commands',
      },
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastFrame()).toContain('messages:1');
  });
});

function createApp(sessionService: object, eventBus: EventBus): Application {
  return {
    getContainer: () => ({
      get: (name: string) => {
        if (name === 'session') {
          return sessionService;
        }
        if (name === 'eventBus') {
          return eventBus;
        }
        throw new Error(`Unknown service: ${name}`);
      },
    }),
  } as unknown as Application;
}
