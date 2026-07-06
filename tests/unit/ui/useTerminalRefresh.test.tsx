import { Text } from 'ink';
import { render } from 'ink-testing-library';
import React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalRefresh } from '../../../src/ui/hooks/useTerminalRefresh';

function RefreshProbe() {
  const { terminalWidth } = useTerminalRefresh();
  return <Text>{`width ${terminalWidth}`}</Text>;
}

describe('useTerminalRefresh', () => {
  const originalIsTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  const originalColumns = Object.getOwnPropertyDescriptor(process.stdout, 'columns');

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(process.stdout, 'columns', {
      configurable: true,
      value: 80,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    process.stdout.removeAllListeners('resize');
    if (originalIsTty) Object.defineProperty(process.stdout, 'isTTY', originalIsTty);
    if (originalColumns) Object.defineProperty(process.stdout, 'columns', originalColumns);
  });

  it('coalesces burst resize events and updates width without clearing the screen', async () => {
    const { lastFrame } = render(<RefreshProbe />);
    await act(async () => {});

    Object.defineProperty(process.stdout, 'columns', {
      configurable: true,
      value: 100,
    });
    for (let i = 0; i < 10; i += 1) {
      process.stdout.emit('resize');
    }

    await vi.advanceTimersByTimeAsync(500);

    expect(lastFrame()).toContain('width 100');
  });

  it('ignores unchanged widths and non-TTY output', async () => {
    const { unmount } = render(<RefreshProbe />);
    await act(async () => {});

    process.stdout.emit('resize');
    await vi.advanceTimersByTimeAsync(500);
    expect(process.stdout.columns).toBe(80);

    unmount();
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    });
    render(<RefreshProbe />);
    Object.defineProperty(process.stdout, 'columns', {
      configurable: true,
      value: 120,
    });
    process.stdout.emit('resize');
    await vi.advanceTimersByTimeAsync(500);
  });
});
