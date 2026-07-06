import { describe, expect, it } from 'vitest';
import {
  selectTypingProtectedWorkbenchState,
  type TypingProtectedWorkbenchState,
} from '../../../src/ui/workbench/TypingProtectedWorkbenchState';

describe('TypingProtectedWorkbenchState', () => {
  it('uses the current dynamic state when the user is not typing', () => {
    const current = createState('Running bash');
    const previous = createState('Reading file');

    expect(
      selectTypingProtectedWorkbenchState({
        current,
        previous,
        inputDraftActive: false,
      })
    ).toBe(current);
  });

  it('freezes the previous dynamic state while the user is typing', () => {
    const current = createState('Streaming model tokens');
    const previous = createState('Reading file');

    const selected = selectTypingProtectedWorkbenchState({
      current,
      previous,
      inputDraftActive: true,
    });

    expect(selected).toBe(previous);
    expect(selected.currentTask).toBe('Reading file');
  });

  it('falls back to the current state when no previous stable frame exists', () => {
    const current = createState('Running first task');

    expect(
      selectTypingProtectedWorkbenchState({
        current,
        inputDraftActive: true,
      })
    ).toBe(current);
  });
});

function createState(currentTask: string): TypingProtectedWorkbenchState {
  return {
    tasks: [
      {
        id: currentTask,
        kind: 'tool',
        description: currentTask,
        status: 'running',
      },
    ],
    currentTask,
    liveModelOutput: {
      runId: 'run-1',
      stage: 'text',
      reasoning: '',
      text: currentTask,
    },
  };
}
