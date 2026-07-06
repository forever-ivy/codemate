import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ResumeSelector } from '../../../src/ui/components/ResumeSelector';

describe('ResumeSelector', () => {
  const mockSessions = [
    {
      sessionId: 'session-1',
      modified: new Date('2024-01-01T10:00:00Z'),
      created: new Date('2024-01-01T09:00:00Z'),
      messageCount: 5,
      summary: 'Test session 1',
    },
  ];

  it('should render session list', () => {
    const { lastFrame } = render(
      <ResumeSelector sessions={mockSessions} onSelect={vi.fn()} onCancel={vi.fn()} />
    );

    expect(lastFrame()).toContain('Resume Session');
    expect(lastFrame()).toContain('Test session 1');
    expect(lastFrame()).toContain('5'); // message count
  });

  it('should show navigation instructions', () => {
    const { lastFrame } = render(
      <ResumeSelector sessions={mockSessions} onSelect={vi.fn()} onCancel={vi.fn()} />
    );

    expect(lastFrame()).toContain('↑↓ Select');
    expect(lastFrame()).toContain('Enter Confirm');
    expect(lastFrame()).toContain('ESC Cancel');
  });

  it('should handle empty sessions list', () => {
    const { lastFrame } = render(
      <ResumeSelector sessions={[]} onSelect={vi.fn()} onCancel={vi.fn()} />
    );

    expect(lastFrame()).toContain('Resume Session');
    expect(lastFrame()).toContain('(0 total)');
  });

  it('should show pagination when there are many sessions', () => {
    const manySessions = Array.from({ length: 15 }, (_, i) => ({
      sessionId: `session-${i}`,
      modified: new Date(),
      created: new Date(),
      messageCount: i + 1,
      summary: `Session ${i}`,
    }));

    const { lastFrame } = render(
      <ResumeSelector sessions={manySessions} onSelect={vi.fn()} onCancel={vi.fn()} />
    );

    expect(lastFrame()).toContain('Page 1 of 2');
    expect(lastFrame()).toContain('← → to navigate pages');
  });
});
