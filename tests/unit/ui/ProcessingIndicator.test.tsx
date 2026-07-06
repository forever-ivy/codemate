import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { ProcessingIndicator } from '../../../src/ui/components/ProcessingIndicator';

describe('ProcessingIndicator', () => {
  it('renders one compact processing status while active', () => {
    const { lastFrame } = render(
      <ProcessingIndicator
        active={true}
        startedAt={1_000}
        now={3_000}
        currentTask="Editing src/App.tsx"
      />
    );

    const output = lastFrame() ?? '';
    expect(output).toContain('Processing...');
    expect(output).toContain('2s');
    expect(output).toContain('Editing src/App.tsx');
    expect(output.split('\n')).toHaveLength(1);
  });

  it('renders nothing while idle', () => {
    const { lastFrame } = render(<ProcessingIndicator active={false} />);
    expect(lastFrame()).toBe('');
  });
});
