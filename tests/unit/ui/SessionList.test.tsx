import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { SessionList } from '../../../src/ui/components/SessionList';
import type { SessionMetadata } from '../../../src/types/index';

describe('SessionList', () => {
  it('should render empty message when no sessions', () => {
    const { lastFrame } = render(<SessionList sessions={[]} currentSessionId={null} />);

    expect(lastFrame()).toContain('No sessions yet');
  });

  it('should render sessions', () => {
    const sessions: SessionMetadata[] = [
      {
        sessionId: 'session-1',
        summary: 'Test session',
        messageCount: 5,
        created: new Date('2024-01-01'),
        modified: new Date('2024-01-01'),
      },
    ];

    const { lastFrame } = render(<SessionList sessions={sessions} currentSessionId="session-1" />);

    const output = lastFrame();
    expect(output).toContain('Sessions:');
    expect(output).toContain('session-1');
    expect(output).toContain('Test session');
    expect(output).toContain('5 messages');
  });

  it('should highlight current session', () => {
    const sessions: SessionMetadata[] = [
      {
        sessionId: 'session-1',
        summary: 'Session 1',
        messageCount: 5,
        created: new Date('2024-01-01'),
        modified: new Date('2024-01-01'),
      },
      {
        sessionId: 'session-2',
        summary: 'Session 2',
        messageCount: 3,
        created: new Date('2024-01-02'),
        modified: new Date('2024-01-02'),
      },
    ];

    const { lastFrame } = render(<SessionList sessions={sessions} currentSessionId="session-1" />);

    const output = lastFrame();
    expect(output).toContain('▶'); // 当前会话标记
  });
});
