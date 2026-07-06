import { Box, Text } from 'ink';
import { render } from 'ink-testing-library';
import React, { act, useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SimpleInput } from '../../../src/ui/components/SimpleInput';

let latestTextInputProps: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
} | null = null;
let textInputRenderCount = 0;

vi.mock('ink-text-input', async () => {
  const ReactModule = await import('react');
  const { Text } = await import('ink');

  function MockTextInput(props: any) {
    textInputRenderCount += 1;
    latestTextInputProps = props;
    return ReactModule.createElement(Text, null, props.value || props.placeholder || '');
  }

  return {
    default: MockTextInput,
  };
});

describe('SimpleInput', () => {
  const getPromptLineIndex = (frame: string) =>
    frame
      .split('\n')
      .findIndex((line) => line.includes('> ') && !line.includes('Type / for commands'));

  const getVisibleSuggestionLines = (frame: string) =>
    frame
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('/'));

  it('should clear the input after submitting an exact slash command', async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(<SimpleInput onSubmit={onSubmit} />);

    await act(async () => {
      latestTextInputProps?.onChange('/help');
    });

    expect(lastFrame()).toContain('/help');

    await act(async () => {
      latestTextInputProps?.onSubmit('/help');
    });

    expect(lastFrame()).not.toContain('> /help');

    await act(async () => {
      stdin.write('\r');
    });

    expect(onSubmit).toHaveBeenCalledWith('/help');
    expect(lastFrame()).not.toContain('> /help');
  });

  it('should render slash command suggestions below the active input row', async () => {
    const { lastFrame } = render(<SimpleInput onSubmit={() => {}} />);

    await act(async () => {
      latestTextInputProps?.onChange('/');
    });

    const frame = lastFrame() ?? '';
    const navigationHintIndex = frame.indexOf('↑↓ navigate');
    const promptIndex = frame.indexOf('> /');

    expect(navigationHintIndex).toBeGreaterThanOrEqual(0);
    expect(promptIndex).toBeGreaterThanOrEqual(0);
    expect(navigationHintIndex).toBeGreaterThan(promptIndex);
  });

  it('should move the input row upward when slash suggestions appear below it', async () => {
    const { lastFrame } = render(<SimpleInput onSubmit={() => {}} />);

    const idleFrame = lastFrame() ?? '';
    const idlePromptLineIndex = getPromptLineIndex(idleFrame);

    await act(async () => {
      latestTextInputProps?.onChange('/');
    });

    const suggestionsFrame = lastFrame() ?? '';
    const suggestionsPromptLineIndex = getPromptLineIndex(suggestionsFrame);

    expect(idlePromptLineIndex).toBeGreaterThanOrEqual(0);
    expect(suggestionsPromptLineIndex).toBeGreaterThanOrEqual(0);
    expect(suggestionsPromptLineIndex).toBeLessThan(idlePromptLineIndex);
  });

  it('should keep the input row stable while typing regular text', async () => {
    const { lastFrame } = render(<SimpleInput onSubmit={() => {}} />);

    const idleFrame = lastFrame() ?? '';
    const idlePromptLineIndex = getPromptLineIndex(idleFrame);

    await act(async () => {
      latestTextInputProps?.onChange('h');
    });

    const oneCharFrame = lastFrame() ?? '';
    const oneCharPromptLineIndex = getPromptLineIndex(oneCharFrame);

    await act(async () => {
      latestTextInputProps?.onChange('hello');
    });

    const wordFrame = lastFrame() ?? '';
    const wordPromptLineIndex = getPromptLineIndex(wordFrame);

    expect(idlePromptLineIndex).toBeGreaterThanOrEqual(0);
    expect(oneCharPromptLineIndex).toBe(idlePromptLineIndex);
    expect(wordPromptLineIndex).toBe(idlePromptLineIndex);
  });

  it('should keep the input visible while the agent is working', () => {
    const { lastFrame } = render(<SimpleInput onSubmit={() => {}} disabled />);

    expect(lastFrame()).toContain('>');
    expect(lastFrame()).toContain('Agent is working • Ctrl+C to stop or exit');
  });

  it('should keep the currently selected slash command on the first visible row', async () => {
    const { stdin, lastFrame } = render(<SimpleInput onSubmit={() => {}} />);

    await act(async () => {
      latestTextInputProps?.onChange('/');
    });

    const initialSuggestions = getVisibleSuggestionLines(lastFrame() ?? '');
    expect(initialSuggestions[0]).toContain('/help');

    await act(async () => {
      stdin.write('\u001B[B');
    });

    const afterDownArrowSuggestions = getVisibleSuggestionLines(lastFrame() ?? '');
    expect(afterDownArrowSuggestions[0]).toContain('/clear');

    await act(async () => {
      stdin.write('\u001B[A');
    });

    const afterUpArrowSuggestions = getVisibleSuggestionLines(lastFrame() ?? '');
    expect(afterUpArrowSuggestions[0]).toContain('/help');
  });

  it('should keep the input row stable while navigating slash suggestions', async () => {
    const { stdin, lastFrame } = render(<SimpleInput onSubmit={() => {}} />);

    await act(async () => {
      latestTextInputProps?.onChange('/');
    });

    const initialSuggestionFrame = lastFrame() ?? '';
    const initialPromptLineIndex = getPromptLineIndex(initialSuggestionFrame);

    await act(async () => {
      stdin.write('\u001B[B');
      stdin.write('\u001B[B');
      stdin.write('\u001B[A');
    });

    const navigatedFrame = lastFrame() ?? '';
    const navigatedPromptLineIndex = getPromptLineIndex(navigatedFrame);

    expect(initialPromptLineIndex).toBeGreaterThanOrEqual(0);
    expect(navigatedPromptLineIndex).toBe(initialPromptLineIndex);
  });

  it('should not recreate the text input for unrelated parent renders', async () => {
    let updateMarker: React.Dispatch<React.SetStateAction<number>> | undefined;

    function Parent() {
      const [marker, setMarker] = useState(0);
      const onSubmit = useCallback(() => {}, []);
      updateMarker = setMarker;

      return (
        <Box flexDirection="column">
          <SimpleInput onSubmit={onSubmit} placeholder="stable input" />
          <Text>{`parent count ${marker}`}</Text>
        </Box>
      );
    }

    textInputRenderCount = 0;
    render(<Parent />);
    const initialCount = textInputRenderCount;

    await act(async () => {
      updateMarker?.(1);
    });

    expect(textInputRenderCount).toBe(initialCount);
  });
});
