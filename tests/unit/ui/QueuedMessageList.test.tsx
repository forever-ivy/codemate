import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QueuedMessageList } from '../../../src/ui/components/QueuedMessageList';

describe('QueuedMessageList', () => {
  it('renders at most three compact queued requests', () => {
    const { lastFrame } = render(
      <QueuedMessageList
        messages={[
          item('1', 'Add a table'),
          item('2', 'Update empty state'),
          item('3', 'Add tests'),
          item('4', 'This item stays hidden'),
        ]}
        onRemove={vi.fn()}
      />
    );

    const output = lastFrame() ?? '';
    expect(output).toContain('Queued · 4');
    expect(output).toContain('Add a table');
    expect(output).toContain('Add tests');
    expect(output).toContain('1 more queued');
    expect(output).not.toContain('This item stays hidden');
  });
});

function item(id: string, content: string) {
  return { id, content, queuedAt: 1_000 };
}
