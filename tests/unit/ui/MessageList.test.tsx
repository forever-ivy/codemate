import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MessageList } from '../../../src/ui/components/MessageList';
import type { Message } from '../../../src/types/index';

describe('MessageList', () => {
  it('should render empty when no messages', () => {
    const { lastFrame } = render(<MessageList messages={[]} />);
    expect(lastFrame()).toBe('');
  });

  it('should render messages', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const { lastFrame } = render(<MessageList messages={messages} />);
    const output = lastFrame();

    expect(output).toContain('You:');
    expect(output).toContain('Hello');
    expect(output).toContain('AI:');
    expect(output).toContain('Hi there!');
  });
});
